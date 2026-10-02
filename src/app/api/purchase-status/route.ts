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
  // just bilingual ones. product_id is included too — it's just a UUID (not
  // sensitive like the fields above) and the Success page needs it for the
  // GA4 purchase event's item_id.
  const SAFE_COLUMNS = 'id,invoice_number,email,amount,currency,status,downloads_limit,downloads_used,account_created,created_at,product_id'
  let { data: purchase, error } = await sb.from('purchases').select(`${SAFE_COLUMNS},book_language`).eq('id', purchaseId).single()
  if (error?.code === '42703') {
    console.error('[purchase-status] purchases.book_language column not found — the migration in supabase/schema.sql §15 has not been run. Retrying without it. RUN THE MIGRATION.')
    const retry = await sb.from('purchases').select(SAFE_COLUMNS).eq('id', purchaseId).single()
    purchase = retry.data
    error = retry.error
  }

  if (error || !purchase) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

  // The Success page needs a human display name for whatever language code
  // this purchase has, including a language an admin added after the fact —
  // it can't rely on a hardcoded ar/en label map anymore. book_languages is
  // public-readable only when is_active=true (see schema §18.1), but a
  // purchase must keep showing its language's name even after the admin
  // disables it later, so this reads with the service-role client rather
  // than relying on that RLS policy. Missing table/row both degrade to a
  // plain null — the Success page falls back to the raw code in that case.
  const bookLanguage = (purchase as any)?.book_language ?? null
  let languageNames: { name_ar: string; name_en: string } | null = null
  if (bookLanguage) {
    const { data: lang } = await sb.from('book_languages').select('name_ar,name_en').eq('language_code', bookLanguage).maybeSingle()
    if (lang) languageNames = lang
  }

  return NextResponse.json({ data: { ...purchase, language_name_ar: languageNames?.name_ar ?? null, language_name_en: languageNames?.name_en ?? null } })
}
