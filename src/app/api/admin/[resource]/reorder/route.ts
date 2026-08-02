import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
  // Every result was previously discarded — if an update failed (schema
  // mismatch, RLS, transient network error), this endpoint still returned
  // {ok:true} and the admin UI showed the reordered list as if it had
  // saved, when the database never actually changed. Check every result
  // and report failures explicitly instead of assuming success.
  const results = await Promise.all(
    orderedIds.map((id, i) => sb.from(config.table).update({ [orderColumn]: i + 1 }).eq(config.idColumn, id))
  )
  const failures = results
    .map((r, i) => ({ id: orderedIds[i], error: r.error }))
    .filter((r): r is { id: string; error: NonNullable<typeof r.error> } => !!r.error)

  if (failures.length > 0) {
    const message = failures.map(f => `${f.id}: ${f.error.message}`).join('; ')
    console.error(`[admin/${resource}/reorder] ${failures.length}/${orderedIds.length} updates failed: ${message}`)
    return NextResponse.json({ error: `فشل حفظ الترتيب لبعض العناصر: ${message}` }, { status: 500 })
  }

  console.log(`[admin/${resource}/reorder] reordered ${orderedIds.length} rows successfully`)
  revalidatePath('/')
  revalidatePath('/faq')
  return NextResponse.json({ ok: true })
}
