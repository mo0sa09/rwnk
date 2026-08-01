import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { insertWithSchemaFallback } from '@/lib/db-resilience'

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
  const customerName = typeof body?.customerName === 'string' ? body.customerName.trim().slice(0, 200) : ''
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

  const purchasePayload: Record<string, unknown> = {
    product_id:     settings.product_id,
    email,
    guest_email:    email,
    amount:         settings.product_price,
    currency:       settings.product_currency ?? 'KWD',
    status:         'pending',
    payment_method: paymentMethod,
    book_language:  bookLanguage,
  }
  if (customerName) purchasePayload.customer_name = customerName

  // book_language and customer_name are both recent additions
  // (supabase/schema.sql §15/§16) that may not exist yet on a database that
  // hasn't had those migrations applied. Checkout is the one path in this
  // app that must never hard-fail just because an optional column is
  // missing, so this drops whichever of them the live schema doesn't have
  // (independently — either, both, or neither) and always completes the
  // insert with whatever columns DO exist.
  const { data: purchase, error: insertErr, droppedFields } = await insertWithSchemaFallback<{ id: string; amount: number; currency: string }>(sb, 'purchases', purchasePayload)
  if (droppedFields.length > 0) {
    console.error(`[checkout] purchases columns not found — dropped from insert: ${droppedFields.join(', ')}. The migration in supabase/schema.sql has not been fully run against this database. RUN THE MIGRATION.`)
  }

  if (insertErr || !purchase) {
    console.error(`[checkout] failed to create pending purchase for ${email}: ${insertErr?.message ?? 'insert returned no row'}`)
    return NextResponse.json({ error: 'تعذّر إنشاء الطلب، حاولي مرة أخرى' }, { status: 500 })
  }

  console.log(`[checkout] pending purchase created — id=${purchase.id} email=${email} amount=${purchase.amount} ${purchase.currency} method=${paymentMethod} language=${bookLanguage}`)

  return NextResponse.json({ purchaseId: purchase.id, amount: purchase.amount, currency: purchase.currency })
}
