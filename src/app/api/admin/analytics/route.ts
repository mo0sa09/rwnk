import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

// Real analytics computed from the actual purchases/downloads tables — no
// mock data. Aggregation happens in JS rather than SQL because this is a
// single-product store with a small row count; if that ever changes this
// should move to a Postgres RPC instead of pulling the whole table.
export async function GET(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const range = request.nextUrl.searchParams.get('range') === 'monthly' ? 'monthly' : 'daily'

  const sb = getAdminDb()
  const since = new Date()
  since.setDate(since.getDate() - (range === 'monthly' ? 365 : 90))

  const { data: purchases, error } = await sb
    .from('purchases')
    .select('id,email,amount,currency,status,payment_method,invoice_number,payment_ref,created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count: downloadsCount } = await sb.from('downloads').select('id', { count: 'exact', head: true })

  const all = purchases ?? []
  const completed = all.filter((p: any) => p.status === 'completed')
  const revenue = completed.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
  const uniqueCustomers = new Set(completed.map((p: any) => p.email)).size

  const statusBreakdown: Record<string, number> = { completed: 0, pending: 0, failed: 0, refunded: 0 }
  for (const p of all) statusBreakdown[p.status] = (statusBreakdown[p.status] ?? 0) + 1

  const methodBreakdown: Record<string, { count: number; revenue: number }> = {}
  for (const p of completed) {
    const m = p.payment_method ?? 'unknown'
    methodBreakdown[m] ??= { count: 0, revenue: 0 }
    methodBreakdown[m].count += 1
    methodBreakdown[m].revenue += Number(p.amount ?? 0)
  }

  // Bucket completed orders by day or month for the chart.
  const buckets = new Map<string, { revenue: number; orders: number }>()
  for (const p of completed) {
    const d = new Date(p.created_at)
    const key = range === 'monthly'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : d.toISOString().slice(0, 10)
    const bucket = buckets.get(key) ?? { revenue: 0, orders: 0 }
    bucket.revenue += Number(p.amount ?? 0)
    bucket.orders += 1
    buckets.set(key, bucket)
  }
  const series = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label, ...v }))

  return NextResponse.json({
    data: {
      revenue,
      totalOrders: all.length,
      completedOrders: completed.length,
      customers: uniqueCustomers,
      downloads: downloadsCount ?? 0,
      avgOrderValue: completed.length ? revenue / completed.length : 0,
      statusBreakdown,
      methodBreakdown,
      series,
      recentPayments: completed.slice(0, 8),
    },
  })
}
