import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

// Reads the single product row (there's only ever one — this is a
// single-product store) so the admin UI can show the current file/version.
export async function GET(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const sb = getAdminDb()
  const { data, error } = await sb.from('products').select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Points the product at newly-uploaded PDF(s) and bumps the corresponding
// version string(s). Accepts the legacy single-file fields (file_path/
// version) for backward compat, plus the bilingual fields (file_path_ar/
// version_ar/file_path_en/version_en) added for the two-language digital
// product feature — the admin UI now always sends the _ar/_en fields; the
// legacy fields remain accepted so nothing else that might call this route
// breaks.
const STRING_FIELDS = ['file_path', 'version', 'file_path_ar', 'version_ar', 'file_path_en', 'version_en'] as const

export async function PATCH(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const body = await request.json()
  const payload: Record<string, string> = {}
  for (const key of STRING_FIELDS) {
    if (typeof body?.[key] === 'string') payload[key] = body[key]
  }
  if (Object.keys(payload).length === 0) return NextResponse.json({ error: 'لا يوجد تغيير' }, { status: 400 })

  const sb = getAdminDb()
  const { data: existing, error: findErr } = await sb.from('products').select('id').single()
  if (findErr || !existing) return NextResponse.json({ error: findErr?.message ?? 'المنتج غير موجود' }, { status: 500 })

  let { data, error } = await sb.from('products').update(payload).eq('id', existing.id).select().single()

  // PGRST204 = PostgREST "column not found in schema cache" — the bilingual
  // migration (supabase/schema.sql §15) hasn't been applied to this database
  // yet. Retry with only the columns that predate it (file_path/version) so
  // an admin can still update SOMETHING rather than getting a hard failure;
  // the _ar/_en fields are silently dropped from this one write until the
  // migration runs (loudly logged so it's diagnosable, not silent to the server).
  if (error?.code === 'PGRST204') {
    console.error('[admin/product-file] one or more of file_path_ar/version_ar/file_path_en/version_en not found — the migration in supabase/schema.sql §15 has not been run against this database. Retrying with only legacy fields. RUN THE MIGRATION.')
    const legacyOnly: Record<string, string> = {}
    if (payload.file_path) legacyOnly.file_path = payload.file_path
    if (payload.version) legacyOnly.version = payload.version
    if (Object.keys(legacyOnly).length === 0) {
      return NextResponse.json({ error: 'تعذّر الحفظ — يجب تطبيق تحديث قاعدة البيانات أولاً (راجع سجلات الخادم)' }, { status: 500 })
    }
    const retry = await sb.from('products').update(legacyOnly).eq('id', existing.id).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
