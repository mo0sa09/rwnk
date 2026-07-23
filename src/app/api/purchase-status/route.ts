import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Server-side (service-role) lookup so the success page can show real order
// data for guest checkouts too — purchases RLS only allows an authenticated
// owner to read their own row, which a fresh guest never has.
export async function GET(request: NextRequest) {
  const purchaseId = request.nextUrl.searchParams.get('purchaseId')
  if (!purchaseId) return NextResponse.json({ error: 'رقم الطلب مفقود' }, { status: 400 })

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'الخدمة غير مهيأة' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  const { data: purchase, error } = await sb.from('purchases')
    .select('id,invoice_number,email,amount,currency,status,downloads_limit,downloads_used,account_created,created_at')
    .eq('id', purchaseId).single()

  if (error || !purchase) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

  return NextResponse.json({ data: purchase })
}
