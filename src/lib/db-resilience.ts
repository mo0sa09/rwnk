// Tolerates schema drift between this codebase and the LIVE database —
// discovered via a live audit that most of supabase/schema.sql's ALTER
// TABLE / CREATE TABLE statements past the original base schema had never
// actually been applied to production (PostgREST's REST API can't run DDL,
// so adding a migration to that file does not apply it by itself; someone
// has to paste it into the Supabase SQL Editor).
//
// Two distinct failure modes, both real and both observed live:
//   PGRST204 — "column not found in schema cache": the TABLE exists but one
//     or more columns in this write don't. A Postgres UPDATE is atomic, so
//     a single unknown column blocks the ENTIRE statement — including
//     fields that DO exist and would otherwise have saved fine. This is
//     recoverable: drop just the offending column and retry.
//   PGRST205 — "table not found in schema cache": the whole table is
//     missing. Nothing can be salvaged by dropping fields; the caller needs
//     a clear, honest error rather than a raw PostgREST message.

export interface SchemaFallbackResult<T> {
  data: T | null
  error: { message: string; code?: string } | null
  droppedFields: string[]
}

function extractMissingColumn(message: string | undefined): string | null {
  const match = message?.match(/Could not find the '([^']+)' column/)
  return match ? match[1] : null
}

export function isMissingTableError(error: { code?: string } | null | undefined): boolean {
  return error?.code === 'PGRST205'
}

// A clear, actionable message for the one failure mode nothing can work
// around: the table itself doesn't exist yet. Used in place of PostgREST's
// raw "Could not find the table '...' in the schema cache" so an admin
// (or the UI surfacing this) gets a plain explanation instead of a
// database-internals error string.
export function missingTableMessage(table: string): string {
  return `هذه الميزة تحتاج تحديث قاعدة البيانات — الجدول "${table}" غير موجود بعد. راجعي "حالة النظام" في لوحة التحكم لمعرفة التفاصيل.`
}

// Runs `sb.from(table).update(payload).eq(matchColumn, matchValue).select().single()`,
// and on a "column not found" error, removes exactly that column from the
// payload and retries — repeatedly, since PostgREST only reports one
// missing column per error. Bounded to avoid ever looping forever on an
// unexpected error shape. Every dropped field is returned so the caller can
// tell the admin exactly what did and didn't save, instead of a silent
// partial success or a confusing 500.
export async function updateWithSchemaFallback<T = any>(
  sb: any,
  table: string,
  matchColumn: string,
  matchValue: string,
  payload: Record<string, unknown>
): Promise<SchemaFallbackResult<T>> {
  const remaining = { ...payload }
  const droppedFields: string[] = []

  for (let attempt = 0; attempt < 30; attempt++) {
    if (Object.keys(remaining).length === 0) {
      return {
        data: null,
        error: { message: `Every field in this update referenced a column that doesn't exist on '${table}' — a database migration is required before anything here can be saved.`, code: 'PGRST204' },
        droppedFields,
      }
    }

    const { data, error } = await sb.from(table).update(remaining).eq(matchColumn, matchValue).select().single()

    if (!error) {
      if (droppedFields.length > 0) {
        console.warn(`[db-resilience] ${table}.${matchColumn}=${matchValue} — saved successfully but DROPPED missing columns: ${droppedFields.join(', ')}. Run the pending database migration (see /api/admin/system-status) to enable these fields.`)
      }
      return { data, error: null, droppedFields }
    }

    if (error.code !== 'PGRST204') {
      return { data: null, error, droppedFields }
    }

    const badColumn = extractMissingColumn(error.message)
    if (!badColumn || !(badColumn in remaining)) {
      // Defensive: if we can't identify (or already removed) the offending
      // column, stop retrying rather than loop — this would only happen if
      // PostgREST's error format ever changes.
      return { data: null, error, droppedFields }
    }
    delete remaining[badColumn]
    droppedFields.push(badColumn)
  }

  return { data: null, error: { message: 'Too many missing columns — stopped retrying after 30 attempts.', code: 'PGRST204' }, droppedFields }
}

// Same idea as updateWithSchemaFallback but for INSERT, where there's no
// existing row to fall back to — used by /api/checkout, which now has two
// independently-optional columns (book_language, customer_name) that may or
// may not exist depending on which migrations have been applied.
export async function insertWithSchemaFallback<T = any>(
  sb: any,
  table: string,
  payload: Record<string, unknown>
): Promise<SchemaFallbackResult<T>> {
  const remaining = { ...payload }
  const droppedFields: string[] = []

  for (let attempt = 0; attempt < 30; attempt++) {
    const { data, error } = await sb.from(table).insert(remaining).select().single()

    if (!error) {
      if (droppedFields.length > 0) {
        console.warn(`[db-resilience] insert into ${table} saved successfully but DROPPED missing columns: ${droppedFields.join(', ')}. Run the pending database migration (see /api/admin/system-status) to enable these fields.`)
      }
      return { data, error: null, droppedFields }
    }

    if (error.code !== 'PGRST204') {
      return { data: null, error, droppedFields }
    }

    const badColumn = extractMissingColumn(error.message)
    if (!badColumn || !(badColumn in remaining)) {
      return { data: null, error, droppedFields }
    }
    delete remaining[badColumn]
    droppedFields.push(badColumn)
  }

  return { data: null, error: { message: 'Too many missing columns — stopped retrying after 30 attempts.', code: 'PGRST204' }, droppedFields }
}

export interface ExpectedTable {
  table: string
  columns: string[]
}

export interface SchemaAudit {
  reachable: boolean
  missingTables: string[]
  missingColumns: Record<string, string[]>
  error?: string
}

// Compares the LIVE database schema (read straight from PostgREST's own
// OpenAPI description of itself, which always reflects reality — unlike
// supabase/schema.sql, which only reflects what's checked into the repo)
// against what this codebase expects to be able to read/write. Powers the
// admin "System Status" diagnostic so a missing migration shows up as a
// clear, itemized checklist instead of being discovered one silent save
// failure at a time.
export async function auditSchema(url: string, key: string, expected: ExpectedTable[]): Promise<SchemaAudit> {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { reachable: false, missingTables: [], missingColumns: {}, error: `Supabase schema endpoint returned HTTP ${res.status}` }
    }
    const spec = await res.json()
    const definitions = spec.definitions ?? {}
    const missingTables: string[] = []
    const missingColumns: Record<string, string[]> = {}

    for (const { table, columns } of expected) {
      const def = definitions[table]
      if (!def) {
        missingTables.push(table)
        continue
      }
      const liveColumns = new Set(Object.keys(def.properties ?? {}))
      const missing = columns.filter(c => !liveColumns.has(c))
      if (missing.length > 0) missingColumns[table] = missing
    }

    return { reachable: true, missingTables, missingColumns }
  } catch (e) {
    return { reachable: false, missingTables: [], missingColumns: {}, error: e instanceof Error ? e.message : 'Unknown error reaching Supabase' }
  }
}
