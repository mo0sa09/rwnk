import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

// purchases/downloads have no client-readable RLS policy for admins (only
// `auth.uid() = user_id` for a customer's own rows) — the dashboard has to
// go through the service-role client, same as every other /api/admin/* route.
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()

  const { data: purchases, error: purchasesErr } = await sb
    .from('purchases')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
  if (purchasesErr) return NextResponse.json({ error: purchasesErr.message }, { status: 500 })

  const { data: downloads, error: downloadsErr } = await sb.from('downloads').select('id')
  if (downloadsErr) return NextResponse.json({ error: downloadsErr.message }, { status: 500 })

  const revenue = (purchases ?? []).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0)
  const customers = [...new Map((purchases ?? []).map((p: any) => [p.email, p])).values()]

  return NextResponse.json({
    data: {
      revenue,
      customers: customers.length,
      downloads: (downloads ?? []).length,
      purchases: (purchases ?? []).slice(0, 5),
      customerList: customers,
    },
  })
}
