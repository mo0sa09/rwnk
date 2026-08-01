import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

// Server-side (service-role) lookup so the success page can show real order
// data for guest checkouts too — purchases RLS only allows an authenticated
// owner to read their own row, which a fresh guest never has.
export async function GET(request: NextRequest) {
  const purchaseId = request.nextUrl.searchParams.get('purchaseId')
  if (!purchaseId) return NextResponse.json({ error: 'رقم الطلب مفقود' }, { status: 400 })

  const { url: sbUrl, key: sbKey } = getSupabaseServerEnv()
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'الخدمة غير مهيأة' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  let { data: purchase, error } = await sb.from('purchases')
    .select('id,invoice_number,email,amount,currency,status,downloads_limit,downloads_used,account_created,created_at,book_language')
    .eq('id', purchaseId).single()

  // '42703' (raw Postgres "undefined column") is what a SELECT on a missing
  // column actually returns — verified live against this project; it is
  // NOT the same code an INSERT/UPDATE returns for the same underlying
  // problem (that's 'PGRST204', PostgREST's own schema-cache error — see
  // /api/checkout). Meaning the book_language migration (supabase/schema.sql
  // §15) hasn't been applied yet. This endpoint is what the Success page
  // depends on for EVERY purchase, not just bilingual ones — it must never
  // hard-fail just because one extra column is missing, so retry without it
  // and let the Success page fall back to displaying Arabic by default
  // (same default the DB itself uses).
  if (error?.code === '42703') {
    console.error('[purchase-status] purchases.book_language column not found — the migration in supabase/schema.sql §15 has not been run against this database. Retrying without it. RUN THE MIGRATION.')
    const retry = await sb.from('purchases')
      .select('id,invoice_number,email,amount,currency,status,downloads_limit,downloads_used,account_created,created_at')
      .eq('id', purchaseId).single()
    purchase = retry.data
    error = retry.error
  }

  if (error || !purchase) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

  return NextResponse.json({ data: purchase })
}
