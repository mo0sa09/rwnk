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

  // Deliberately NOT select('*') — unlike /api/payment/callback (server-only
  // internal use), this route hands the row straight to an unauthenticated
  // client (purchaseId is the only "auth", and it's just an unguessable
  // UUID). select('*') would leak payment_ref, transaction_details (raw
  // gateway response), user_id, guest_email, etc. Keep an explicit
  // client-safe allowlist, but tolerate book_language not existing yet
  // (migration not applied) rather than 42703'ing the whole query — this
  // endpoint is what the Success page depends on for EVERY purchase, not
  // just bilingual ones.
  const SAFE_COLUMNS = 'id,invoice_number,email,amount,currency,status,downloads_limit,downloads_used,account_created,created_at'
  let { data: purchase, error } = await sb.from('purchases').select(`${SAFE_COLUMNS},book_language`).eq('id', purchaseId).single()
  if (error?.code === '42703') {
    console.error('[purchase-status] purchases.book_language column not found — the migration in supabase/schema.sql §15 has not been run. Retrying without it. RUN THE MIGRATION.')
    const retry = await sb.from('purchases').select(SAFE_COLUMNS).eq('id', purchaseId).single()
    purchase = retry.data
    error = retry.error
  }

  if (error || !purchase) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

  return NextResponse.json({ data: purchase })
}
