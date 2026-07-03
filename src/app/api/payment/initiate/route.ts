import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function initMyFatoorah(payload: {
  email: string; amount: number; purchaseId: string; callbackUrl: string; errorUrl: string
}) {
  const apiKey  = process.env.MYFATOORAH_API_KEY!
  const baseUrl = process.env.MYFATOORAH_BASE_URL ?? 'https://apitest.myfatoorah.com'

  const execRes = await fetch(`${baseUrl}/v2/ExecutePayment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      PaymentMethodId:    '0',           // 0 = show all methods
      CustomerName:       'رونق عميل',
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
  const exec = await execRes.json()
  if (!exec.IsSuccess) throw new Error(exec.Message ?? 'MyFatoorah error')
  return { paymentUrl: exec.Data.PaymentURL as string, invoiceId: exec.Data.InvoiceId?.toString() as string }
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
  const { email, amount, purchaseId } = await request.json()
  if (!email || !amount || !purchaseId)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const gateway    = (process.env.PAYMENT_GATEWAY ?? 'myfatoorah') as 'myfatoorah' | 'tap'
  const callbackUrl = `${appUrl}/api/payment/callback?purchaseId=${purchaseId}&gateway=${gateway}`
  const errorUrl    = `${appUrl}/checkout?error=payment_failed&purchaseId=${purchaseId}`

  try {
    const result = gateway === 'tap'
      ? await initTap({ email, amount, purchaseId, callbackUrl })
      : await initMyFatoorah({ email, amount, purchaseId, callbackUrl, errorUrl })

    // Store gateway invoice ID against purchase
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (sbUrl && sbKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(sbUrl, sbKey) as any
      await sb.from('purchases').update({ payment_ref: result.invoiceId }).eq('id', purchaseId)
    }

    return NextResponse.json({ paymentUrl: result.paymentUrl, invoiceId: result.invoiceId })
  } catch (err: any) {
    console.error('[payment/initiate]', err.message)
    return NextResponse.json({ error: err.message ?? 'Gateway error' }, { status: 500 })
  }
}
