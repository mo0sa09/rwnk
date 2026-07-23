import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from('discount_codes').select('*').order('created_at', { ascending: false })
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from('discount_codes').insert({
    code: String(body.code ?? '').toUpperCase(),
    discount_type: body.discount_type,
    discount_value: body.discount_value,
    max_uses: body.max_uses ?? null,
    expires_at: body.expires_at ?? null,
  }).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}
