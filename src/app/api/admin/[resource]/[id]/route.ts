import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { RESOURCES, pickFields } from '@/lib/admin-resources'
import { isMissingTableError, missingTableMessage, updateWithSchemaFallback } from '@/lib/db-resilience'

function revalidateFor(resource: string, id: string) {
  revalidatePath('/')
  revalidatePath('/faq')
  if (resource === 'pages' && ['about', 'terms', 'privacy', 'refund'].includes(id)) revalidatePath(`/${id}`)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const payload = pickFields(body, config.fields)

  const sb = getAdminDb()
  // Same atomicity risk as store_settings: a single unknown column would
  // otherwise block the entire update, including fields that DO exist.
  const { data, error: dbErr, droppedFields } = await updateWithSchemaFallback(sb, config.table, config.idColumn, id, payload)
  if (dbErr) {
    if (isMissingTableError(dbErr)) {
      console.error(`[admin/${resource}/${id}] cannot update — table '${config.table}' does not exist — pending migration in supabase/schema.sql has not been applied.`)
      return NextResponse.json({ error: missingTableMessage(config.table), migrationRequired: true }, { status: 503 })
    }
    console.error(`[admin/${resource}/${id}] update failed: ${dbErr.message}${droppedFields.length ? ` (already dropped: ${droppedFields.join(', ')})` : ''}`)
    return NextResponse.json({ error: dbErr.message, droppedFields }, { status: 500 })
  }
  if (droppedFields.length > 0) {
    console.warn(`[admin/${resource}/${id}] saved, but these fields don't exist on the live database yet and were skipped: ${droppedFields.join(', ')} — run the pending migration (supabase/schema.sql) to enable them.`)
  }
  revalidateFor(resource, id)
  return NextResponse.json({ data, droppedFields })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  const { error: dbErr } = await sb.from(config.table).delete().eq(config.idColumn, id)
  if (dbErr) {
    if (isMissingTableError(dbErr)) {
      console.error(`[admin/${resource}/${id}] cannot delete — table '${config.table}' does not exist — pending migration in supabase/schema.sql has not been applied.`)
      return NextResponse.json({ error: missingTableMessage(config.table), migrationRequired: true }, { status: 503 })
    }
    console.error(`[admin/${resource}/${id}] delete failed: ${dbErr.message}`)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  revalidateFor(resource, id)
  return NextResponse.json({ ok: true })
}
