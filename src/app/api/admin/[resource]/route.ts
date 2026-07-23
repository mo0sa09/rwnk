import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { RESOURCES, pickFields } from '@/lib/admin-resources'

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  let query = sb.from(config.table).select('*')
  if (config.orderColumn) query = query.order(config.orderColumn, { ascending: true })
  const { data, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const payload = pickFields(body, config.fields)

  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from(config.table).insert(payload).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}
