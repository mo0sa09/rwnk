import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function initMyFatoorah(payload: {
  email: string; amount: number; purchaseId: string; callbackUrl: string; errorUrl: string
}) {
  const apiKey  = process.env.MYFATOORAH_API_KEY!
  const baseUrl = process.env.MYFATOORAH_BASE_URL ?? 'https://apitest.myfatoorah.com'

  // v2/SendPayment (not ExecutePayment). ExecutePayment requires either a
  // real PaymentMethodId obtained from InitiatePayment first, or a SessionId
  // from the embedded-payment flow — there is no documented "0 = all
  // methods" value for it. SendPayment with NotificationOption: 'LNK'
  // creates an invoice and returns a hosted InvoiceURL listing every
  // enabled payment method, which is what "PaymentMethodId: 0" was trying
  // (incorrectly) to achieve.
  const sendRes = await fetch(`${baseUrl}/v2/SendPayment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      CustomerName:       'رونق عميل',
      NotificationOption: 'LNK',
      DisplayCurrencyIso: 'KWD',
      CustomerEmail:      payload.email,
      InvoiceValue:       payload.amount,
      CallBackUrl:        payload.callbackUrl,
      ErrorUrl:           payload.errorUrl,
      Language:           'AR',
      CustomerReference:  payload.purchaseId,
      UserDefinedField:   payload.purchaseId,
    }),
  })
  const send = await sendRes.json()
  console.log('[myfatoorah/SendPayment] response', JSON.stringify(send))
  if (!send.IsSuccess) {
    const detail = send.ValidationErrors?.map((e: any) => `${e.Name}: ${e.Error}`).join('; ')
    throw new Error(detail || send.Message || 'MyFatoorah error')
  }
  return { paymentUrl: send.Data.InvoiceURL as string, invoiceId: send.Data.InvoiceId?.toString() as string }
}

async function initTap(payload: {
  email: string; amount: number; purchaseId: string; callbackUrl: string
}) {
  const res = await fetch('https://api.tap.company/v2/charges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TAP_SECRET_KEY!}` },
    body: JSON.stringify({
      amount: payload.amount, currency: 'KWD',
      description: 'كتاب رونق — دليل التنظيف',
      source: { id: 'src_all' },
      post:     { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback` },
      redirect: { url: payload.callbackUrl },
      customer: { email: payload.email, first_name: 'رونق', last_name: 'عميل' },
      metadata: { purchaseId: payload.purchaseId },
      reference: { merchant: payload.purchaseId },
    }),
  })
  const charge = await res.json()
  if (charge.errors) throw new Error(charge.errors[0]?.description ?? 'Tap error')
  return { paymentUrl: charge.transaction?.url as string, invoiceId: charge.id as string }
}

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const purchaseId = typeof body?.purchaseId === 'string' ? body.purchaseId : ''
  if (!purchaseId) return NextResponse.json({ error: 'Missing purchaseId' }, { status: 400 })

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  // Amount and email are never taken from the client — always re-read from
  // the purchase row that /api/checkout created server-side.
  const { data: purchase, error: findErr } = await sb.from('purchases')
    .select('id,email,amount,status').eq('id', purchaseId).single()

  if (findErr || !purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  if (purchase.status !== 'pending') return NextResponse.json({ error: 'Purchase is not pending' }, { status: 409 })

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const gateway    = (process.env.PAYMENT_GATEWAY ?? 'myfatoorah') as 'myfatoorah' | 'tap'
  const callbackUrl = `${appUrl}/api/payment/callback?purchaseId=${purchaseId}&gateway=${gateway}`
  const errorUrl    = `${appUrl}/checkout?error=payment_failed&purchaseId=${purchaseId}`

  try {
    const result = gateway === 'tap'
      ? await initTap({ email: purchase.email, amount: purchase.amount, purchaseId, callbackUrl })
      : await initMyFatoorah({ email: purchase.email, amount: purchase.amount, purchaseId, callbackUrl, errorUrl })

    await sb.from('purchases').update({ payment_ref: result.invoiceId }).eq('id', purchaseId)

    return NextResponse.json({ paymentUrl: result.paymentUrl, invoiceId: result.invoiceId })
  } catch (err: any) {
    console.error('[payment/initiate]', err.message)
    return NextResponse.json({ error: err.message ?? 'Gateway error' }, { status: 500 })
  }
}
