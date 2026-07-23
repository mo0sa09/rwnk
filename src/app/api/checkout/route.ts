import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_METHODS = new Set(['card', 'knet', 'apple'])

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

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any

  const { data: settings, error: settingsErr } = await sb.from('store_settings').select('product_id,product_price,product_currency').single()
  if (settingsErr || !settings) return NextResponse.json({ error: 'تعذّر تحميل بيانات المنتج' }, { status: 500 })

  const { data: purchase, error: insertErr } = await sb.from('purchases').insert({
    product_id:     settings.product_id,
    email,
    guest_email:    email,
    amount:         settings.product_price,
    currency:       settings.product_currency ?? 'KWD',
    status:         'pending',
    payment_method: paymentMethod,
  }).select('id,amount,currency').single()

  if (insertErr || !purchase) {
    console.error('[checkout]', insertErr?.message)
    return NextResponse.json({ error: 'تعذّر إنشاء الطلب، حاولي مرة أخرى' }, { status: 500 })
  }

  return NextResponse.json({ purchaseId: purchase.id, amount: purchase.amount, currency: purchase.currency })
}
