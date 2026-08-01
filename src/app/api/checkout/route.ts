import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_METHODS = new Set(['card', 'knet', 'apple'])
const VALID_LANGUAGES = new Set(['ar', 'en'])

// Creates a pending purchase with a server-verified price — the client
// never gets to decide how much a purchase costs.
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const paymentMethod = VALID_METHODS.has(body?.paymentMethod) ? body.paymentMethod : 'card'
  const bookLanguage = VALID_LANGUAGES.has(body?.bookLanguage) ? body.bookLanguage : 'ar'

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
  }

  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any

  const { data: settings, error: settingsErr } = await sb.from('store_settings').select('product_id,product_price,product_currency').single()
  if (settingsErr || !settings) return NextResponse.json({ error: 'تعذّر تحميل بيانات المنتج' }, { status: 500 })

  const basePurchase = {
    product_id:     settings.product_id,
    email,
    guest_email:    email,
    amount:         settings.product_price,
    currency:       settings.product_currency ?? 'KWD',
    status:         'pending',
    payment_method: paymentMethod,
  }

  let { data: purchase, error: insertErr } = await sb.from('purchases')
    .insert({ ...basePurchase, book_language: bookLanguage })
    .select('id,amount,currency').single()

  // PGRST204 = "column not found in schema cache" — the book_language
  // migration (supabase/schema.sql §15) hasn't been applied to this
  // database yet. A previous live audit found that an unapplied migration
  // referenced by a write can silently break the ENTIRE write, not just the
  // new field — checkout is the one path in this app that must never break,
  // so this retries without book_language rather than failing the purchase
  // outright. The customer's language choice is lost for this one purchase
  // (defaults to 'ar' downstream), but they can still pay and receive their
  // book — never a hard failure just because a column is missing.
  if (insertErr?.code === 'PGRST204') {
    console.error(`[checkout] purchases.book_language column not found — the migration in supabase/schema.sql §15 has not been run against this database. Retrying insert WITHOUT book_language so checkout still works (customer's language selection for this purchase will be lost, defaulting to 'ar'). RUN THE MIGRATION.`)
    const retry = await sb.from('purchases').insert(basePurchase).select('id,amount,currency').single()
    purchase = retry.data
    insertErr = retry.error
  }

  if (insertErr || !purchase) {
    console.error(`[checkout] failed to create pending purchase for ${email}: ${insertErr?.message ?? 'insert returned no row'}`)
    return NextResponse.json({ error: 'تعذّر إنشاء الطلب، حاولي مرة أخرى' }, { status: 500 })
  }

  console.log(`[checkout] pending purchase created — id=${purchase.id} email=${email} amount=${purchase.amount} ${purchase.currency} method=${paymentMethod} language=${bookLanguage}`)

  return NextResponse.json({ purchaseId: purchase.id, amount: purchase.amount, currency: purchase.currency })
}
