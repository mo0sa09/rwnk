import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

// Aggregates purchases per customer email. The previous approach (dedupe by
// email keeping whichever row a Map happened to see last) silently dropped
// a repeat customer's other orders and showed only one order's amount as if
// it were their total — this sums every completed order instead.
export async function GET(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const search = request.nextUrl.searchParams.get('search')?.trim() ?? ''

  const sb = getAdminDb()
  let query = sb.from('purchases').select('email,amount,payment_method,status,created_at').eq('status', 'completed')
  if (search) query = query.ilike('email', `%${search}%`)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byEmail = new Map<string, { email: string; total_spent: number; order_count: number; last_purchase: string; last_payment_method: string | null }>()
  for (const p of data ?? []) {
    const existing = byEmail.get(p.email)
    if (existing) {
      existing.total_spent += Number(p.amount ?? 0)
      existing.order_count += 1
    } else {
      byEmail.set(p.email, {
        email: p.email,
        total_spent: Number(p.amount ?? 0),
        order_count: 1,
        last_purchase: p.created_at,
        last_payment_method: p.payment_method,
      })
    }
  }

  const customers = [...byEmail.values()].sort((a, b) => new Date(b.last_purchase).getTime() - new Date(a.last_purchase).getTime())
  return NextResponse.json({ data: customers, total: customers.length })
}
