import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { RESOURCES } from '@/lib/admin-resources'

export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const config = RESOURCES[resource]
  if (!config || !config.orderColumn) return NextResponse.json({ error: 'Resource is not reorderable' }, { status: 400 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const { orderedIds }: { orderedIds: string[] } = await request.json()
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 })

  const sb = getAdminDb()
  const orderColumn = config.orderColumn
  await Promise.all(
    orderedIds.map((id, i) => sb.from(config.table).update({ [orderColumn]: i + 1 }).eq(config.idColumn, id))
  )
  return NextResponse.json({ ok: true })
}
