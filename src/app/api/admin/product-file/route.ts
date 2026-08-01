import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { updateWithSchemaFallback } from '@/lib/db-resilience'

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

  // The bilingual columns (file_path_ar/version_ar/file_path_en/version_en)
  // may not exist yet on a database that hasn't had supabase/schema.sql §15
  // applied. Previously this route's fallback dropped ALL of them at once
  // and retried with ONLY legacy file_path/version — but the admin UI always
  // PATCHes one language at a time (see ProductTab.handleDigitalFileUploaded),
  // so a payload of just {file_path_en, version_en} had nothing left to fall
  // back to and the save hard-failed. Concretely: uploading the English PDF
  // from the dashboard could never succeed until the migration ran — which
  // is very likely the real root cause of "English selected but Arabic PDF
  // downloaded," not a bug in the language-selection flow itself. Using the
  // shared column-by-column fallback here saves whatever CAN be saved and
  // reports exactly what was dropped, same as store_settings.
  const { data, error, droppedFields } = await updateWithSchemaFallback(sb, 'products', 'id', existing.id, payload)
  if (error) {
    console.error(`[admin/product-file] update failed: ${error.message}${droppedFields.length ? ` (already dropped: ${droppedFields.join(', ')})` : ''}`)
    return NextResponse.json({ error: error.message, droppedFields }, { status: 500 })
  }
  if (droppedFields.length > 0) {
    console.warn(`[admin/product-file] saved, but these fields don't exist on the live database yet and were skipped: ${droppedFields.join(', ')} — run the pending migration (supabase/schema.sql §15) to enable bilingual file storage.`)
  }
  return NextResponse.json({ data, droppedFields })
}
