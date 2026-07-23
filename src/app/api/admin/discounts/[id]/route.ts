import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from('discount_codes').update({ is_active: body.is_active }).eq('id', id).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  const { error: dbErr } = await sb.from('discount_codes').delete().eq('id', id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
