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

// Points the product at a newly-uploaded PDF (path returned by
// /api/admin/upload with kind=product-pdf) and bumps its version string.
export async function PATCH(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const body = await request.json()
  const filePath = typeof body?.file_path === 'string' ? body.file_path : null
  const version = typeof body?.version === 'string' ? body.version : null
  if (!filePath && !version) return NextResponse.json({ error: 'لا يوجد تغيير' }, { status: 400 })

  const sb = getAdminDb()
  const { data: existing, error: findErr } = await sb.from('products').select('id').single()
  if (findErr || !existing) return NextResponse.json({ error: findErr?.message ?? 'المنتج غير موجود' }, { status: 500 })

  const payload: Record<string, string> = {}
  if (filePath) payload.file_path = filePath
  if (version) payload.version = version

  const { data, error } = await sb.from('products').update(payload).eq('id', existing.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
