import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { RESOURCES, pickFields } from '@/lib/admin-resources'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const payload = pickFields(body, config.fields)

  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from(config.table).update(payload).eq(config.idColumn, id).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  const { error: dbErr } = await sb.from(config.table).delete().eq(config.idColumn, id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
