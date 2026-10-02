// Shared between /api/admin/book-languages and /api/admin/book-languages/[id]
// — kept out of the route files themselves since Next.js route modules only
// expect HTTP-verb exports (GET/POST/PUT/DELETE/...).

// Also enforced by a CHECK constraint on the table itself
// (supabase/schema.sql §18.1) — duplicated here so a bad code is rejected
// with a clear Arabic message before ever reaching the database, and because
// this exact code is used as a Storage path segment (books/{code}/...).
export const BOOK_LANGUAGE_CODE_RE = /^[a-z]{2,10}$/

export function normalizeLanguageCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export interface BookLanguagePayload {
  name_ar: string
  name_en: string
  is_active: boolean
  file_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  sort_order: number
}

export function parseBookLanguagePayload(body: any): BookLanguagePayload | null {
  const name_ar = typeof body?.name_ar === 'string' ? body.name_ar.trim() : ''
  const name_en = typeof body?.name_en === 'string' ? body.name_en.trim() : ''
  if (!name_ar || !name_en) return null
  return {
    name_ar,
    name_en,
    is_active: !!body?.is_active,
    file_path: typeof body?.file_path === 'string' && body.file_path ? body.file_path : null,
    file_name: typeof body?.file_name === 'string' && body.file_name ? body.file_name : null,
    file_size: typeof body?.file_size === 'number' && Number.isFinite(body.file_size) ? body.file_size : null,
    mime_type: typeof body?.mime_type === 'string' && body.mime_type ? body.mime_type : 'application/pdf',
    sort_order: typeof body?.sort_order === 'number' ? body.sort_order : 0,
  }
}

// PUT allows a partial update (e.g. just {is_active} to toggle, or just the
// file_* fields after a replace-PDF upload) — unlike create, name_ar/name_en
// are not required to be present in every call.
export function parseBookLanguagePatch(body: any): Partial<BookLanguagePayload> {
  const out: Partial<BookLanguagePayload> = {}
  if (typeof body?.name_ar === 'string' && body.name_ar.trim()) out.name_ar = body.name_ar.trim()
  if (typeof body?.name_en === 'string' && body.name_en.trim()) out.name_en = body.name_en.trim()
  if (typeof body?.is_active === 'boolean') out.is_active = body.is_active
  if ('file_path' in (body ?? {})) out.file_path = typeof body.file_path === 'string' && body.file_path ? body.file_path : null
  if ('file_name' in (body ?? {})) out.file_name = typeof body.file_name === 'string' && body.file_name ? body.file_name : null
  if ('file_size' in (body ?? {})) out.file_size = typeof body.file_size === 'number' && Number.isFinite(body.file_size) ? body.file_size : null
  if (typeof body?.mime_type === 'string' && body.mime_type) out.mime_type = body.mime_type
  if (typeof body?.sort_order === 'number') out.sort_order = body.sort_order
  return out
}
