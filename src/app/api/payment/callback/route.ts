import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface GatewayResult {
  status: 'completed' | 'failed' | 'pending'
  matchesPurchase: boolean
}

// ── MyFatoorah callback ──────────────────────────────────────
async function handleMyFatoorah(invoiceId: string, purchaseId: string): Promise<GatewayResult> {
  const apiKey  = process.env.MYFATOORAH_API_KEY!
  const baseUrl = process.env.MYFATOORAH_BASE_URL ?? 'https://apitest.myfatoorah.com'

  const res = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ Key: invoiceId, KeyType: 'InvoiceId' }),
  })
  const data = await res.json()
  console.log('[myfatoorah/GetPaymentStatus] response', JSON.stringify(data))
  if (!data.IsSuccess) throw new Error('MyFatoorah status check failed')

  // Never trust the invoiceId/purchaseId pairing from the URL alone — confirm
  // the gateway's own record of this invoice references the same purchase
  // (set as CustomerReference/UserDefinedField at SendPayment time).
  const ref = data.Data?.CustomerReference ?? data.Data?.UserDefinedField
  const matchesPurchase = ref === purchaseId

  // MyFatoorah's InvoiceStatus is only ever 'Paid' or 'Pending' — a failed or
  // cancelled attempt still reports 'Pending' at the invoice level. The real
  // outcome has to be read off the most recent entry in InvoiceTransactions.
  const invoiceStatus = data.Data?.InvoiceStatus as string | undefined
  const transactions = (data.Data?.InvoiceTransactions ?? []) as Array<{ TransactionDate: string; TransactionStatus: string }>
  const latest = [...transactions].sort(
    (a, b) => new Date(b.TransactionDate).getTime() - new Date(a.TransactionDate).getTime()
  )[0]

  let status: GatewayResult['status'] = 'pending'
  if (invoiceStatus === 'Paid') status = 'completed'
  else if (latest && ['Failed', 'Canceled', 'Cancelled'].includes(latest.TransactionStatus)) status = 'failed'

  return { status, matchesPurchase }
}

// ── Tap callback ─────────────────────────────────────────────
async function handleTap(chargeId: string, purchaseId: string): Promise<GatewayResult> {
  const res = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY!}` },
  })
  const charge = await res.json()
  console.log('[tap/charges] response', JSON.stringify(charge))
  const ref = charge.metadata?.purchaseId ?? charge.reference?.merchant
  const matchesPurchase = ref === purchaseId
  const status = charge.status === 'CAPTURED' ? 'completed' : charge.status === 'FAILED' ? 'failed' : 'pending'
  return { status, matchesPurchase }
}

async function verifyAndFinalize(purchaseId: string, gateway: string, invoiceId: string | null) {
  if (!invoiceId) return { status: 'pending' as const }

  const result = gateway === 'tap'
    ? await handleTap(invoiceId, purchaseId)
    : await handleMyFatoorah(invoiceId, purchaseId)

  if (!result.matchesPurchase) {
    console.error('[payment/callback] reference mismatch', { purchaseId, gateway, invoiceId })
    throw new Error('Payment reference does not match purchase')
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (sbUrl && sbKey) {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(sbUrl, sbKey) as any
    // Only ever transition a still-pending purchase — never re-finalize one
    // that's already completed/failed/refunded.
    await sb.from('purchases')
      .update({ status: result.status, payment_ref: invoiceId })
      .eq('id', purchaseId).eq('status', 'pending')
  }

  return result
}

// ── GET — redirect-based callback (user returns from gateway) ─
export async function GET(request: NextRequest) {
  const params     = request.nextUrl.searchParams
  const purchaseId = params.get('purchaseId')
  const gateway    = params.get('gateway') ?? 'myfatoorah'
  const invoiceId  = params.get('InvoiceId') ?? params.get('tap_id') ?? params.get('id')
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!purchaseId) return NextResponse.redirect(`${appUrl}/checkout?error=missing_purchase`)

  try {
    const result = await verifyAndFinalize(purchaseId, gateway, invoiceId)
    if (result.status === 'completed') {
      return NextResponse.redirect(`${appUrl}/success?purchaseId=${purchaseId}`)
    }
    return NextResponse.redirect(`${appUrl}/checkout?error=payment_failed&purchaseId=${purchaseId}`)
  } catch (err: any) {
    console.error('[payment/callback GET]', err.message)
    return NextResponse.redirect(`${appUrl}/checkout?error=callback_error`)
  }
}

// ── POST — webhook from gateway (server-to-server) ────────────
export async function POST(request: NextRequest) {
  const body    = await request.json()
  const gateway = request.nextUrl.searchParams.get('gateway') ?? 'myfatoorah'

  try {
    let purchaseId: string | undefined
    let invoiceId: string | undefined

    if (gateway === 'tap') {
      purchaseId = body.metadata?.purchaseId ?? body.reference?.merchant
      invoiceId  = body.id
    } else {
      purchaseId = body.UserDefinedField ?? body.CustomerReference
      invoiceId  = body.InvoiceId?.toString()
    }

    if (!purchaseId || !invoiceId) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

    // Re-verify with the gateway rather than trusting the webhook payload's
    // own status field — a forged POST could otherwise mark any purchase paid.
    const result = await verifyAndFinalize(purchaseId, gateway, invoiceId)
    return NextResponse.json({ received: true, status: result.status })
  } catch (err: any) {
    console.error('[payment/callback POST]', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
