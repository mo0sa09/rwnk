import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { STORE_SETTINGS_FIELDS, pickFields } from '@/lib/admin-resources'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from('store_settings').select('*').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const payload = pickFields(body, STORE_SETTINGS_FIELDS)

  const sb = getAdminDb()
  const { data: existing, error: findErr } = await sb.from('store_settings').select('id').single()
  if (findErr || !existing) return NextResponse.json({ error: findErr?.message ?? 'store_settings row not found' }, { status: 500 })

  const { data, error: dbErr } = await sb.from('store_settings').update(payload).eq('id', existing.id).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}
