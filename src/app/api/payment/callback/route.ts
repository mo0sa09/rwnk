import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── MyFatoorah callback ──────────────────────────────────────
async function handleMyFatoorah(invoiceId: string, purchaseId: string) {
  const apiKey  = process.env.MYFATOORAH_API_KEY!
  const baseUrl = process.env.MYFATOORAH_BASE_URL ?? 'https://apitest.myfatoorah.com'

  const res = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ Key: invoiceId, KeyType: 'InvoiceId' }),
  })
  const data = await res.json()
  if (!data.IsSuccess) throw new Error('MyFatoorah status check failed')

  const status = data.Data?.InvoiceStatus  // 'Paid' | 'Failed' | 'Pending'
  return status === 'Paid' ? 'completed' : status === 'Failed' ? 'failed' : 'pending'
}

// ── Tap callback ─────────────────────────────────────────────
async function handleTap(chargeId: string) {
  const res = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY!}` },
  })
  const charge = await res.json()
  // status: CAPTURED | FAILED | PENDING
  return charge.status === 'CAPTURED' ? 'completed' : charge.status === 'FAILED' ? 'failed' : 'pending'
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
    let paymentStatus = 'pending'

    if (invoiceId) {
      paymentStatus = gateway === 'tap'
        ? await handleTap(invoiceId)
        : await handleMyFatoorah(invoiceId, purchaseId)
    }

    // Update DB
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (sbUrl && sbKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(sbUrl, sbKey) as any
      await sb.from('purchases')
        .update({ status: paymentStatus, payment_ref: invoiceId ?? undefined } as any)
        .eq('id', purchaseId)
    }

    if (paymentStatus === 'completed') {
      return NextResponse.redirect(`${appUrl}/success?purchaseId=${purchaseId}`)
    } else {
      return NextResponse.redirect(`${appUrl}/checkout?error=payment_failed&purchaseId=${purchaseId}`)
    }
  } catch (err: any) {
    console.error('[payment/callback GET]', err.message)
    return NextResponse.redirect(`${appUrl}/checkout?error=callback_error`)
  }
}

// ── POST — webhook from gateway (server-to-server) ────────────
export async function POST(request: NextRequest) {
  const body    = await request.json()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const gateway = request.nextUrl.searchParams.get('gateway') ?? 'myfatoorah'

  try {
    let purchaseId: string | undefined
    let paymentStatus = 'pending'

    if (gateway === 'tap') {
      // Tap sends charge object
      purchaseId = body.metadata?.purchaseId ?? body.reference?.merchant
      paymentStatus = body.status === 'CAPTURED' ? 'completed' : 'failed'
    } else {
      // MyFatoorah sends InvoiceId + UserDefinedField
      purchaseId = body.UserDefinedField
      const invoiceId = body.InvoiceId?.toString()
      if (invoiceId) paymentStatus = await handleMyFatoorah(invoiceId, purchaseId ?? '')
    }

    if (!purchaseId) return NextResponse.json({ error: 'No purchaseId' }, { status: 400 })

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (sbUrl && sbKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(sbUrl, sbKey) as any
      await sb.from('purchases').update({ status: paymentStatus } as any).eq('id', purchaseId)
    }

    return NextResponse.json({ received: true, status: paymentStatus })
  } catch (err: any) {
    console.error('[payment/callback POST]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
