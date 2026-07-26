import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

// Full order list for the admin Orders/Payments screens — search + status
// filter + pagination, server-side (purchases has no client-readable RLS
// policy, same reasoning as /api/admin/stats). purchases.user_id and
// profiles.id both reference auth.users directly rather than each other, so
// there's no FK PostgREST can embed on — full_name is resolved with a
// second query instead of a nested select.
export async function GET(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.trim() ?? ''
  const status = searchParams.get('status') ?? 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const sb = getAdminDb()
  let query = sb.from('purchases').select('*', { count: 'exact' }).order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)
  if (search) query = query.or(`email.ilike.%${search}%,invoice_number.ilike.%${search}%,payment_ref.ilike.%${search}%`)

  const { data, error, count } = await query.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((data ?? []).map((p: any) => p.user_id).filter(Boolean))]
  let namesByUserId: Record<string, string> = {}
  if (userIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id,full_name').in('id', userIds)
    namesByUserId = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]).filter(([, n]: any) => n))
  }

  const orders = (data ?? []).map((p: any) => ({ ...p, customer_name: namesByUserId[p.user_id] ?? null }))

  return NextResponse.json({ data: orders, total: count ?? 0, page, pageSize })
}
