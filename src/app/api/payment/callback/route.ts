import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { deriveMyFatoorahVerdict, decideFinalize, type GatewayStatus } from '@/lib/payment-verify'

export const dynamic = 'force-dynamic'

interface GatewayResult {
  status: GatewayStatus
  matchesPurchase: boolean
  paymentMethod: string | null
  raw: any
}

// ── MyFatoorah verification ──────────────────────────────────
// GetPaymentStatus accepts KeyType 'InvoiceId' (what we store at
// /api/payment/initiate time) or 'PaymentId' (what MyFatoorah appends to
// the CallBackUrl on redirect — note: NOT 'InvoiceId', that param name
// never appears on the redirect at all, which was the root cause of the
// "charged but bounced back to checkout" bug).
async function checkMyFatoorah(key: string, keyType: 'InvoiceId' | 'PaymentId', purchaseId: string): Promise<GatewayResult> {
  const apiKey  = process.env.MYFATOORAH_API_KEY!
  const baseUrl = process.env.MYFATOORAH_BASE_URL ?? 'https://apitest.myfatoorah.com'

  console.log(`[payment/verify] MyFatoorah GetPaymentStatus request — Key=${key} KeyType=${keyType} purchaseId=${purchaseId}`)

  const res = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ Key: key, KeyType: keyType }),
  })
  const data = await res.json()
  console.log('[payment/verify] MyFatoorah GetPaymentStatus response', JSON.stringify(data))

  if (!data.IsSuccess) {
    throw new Error(`MyFatoorah status check failed: ${data.Message ?? 'unknown error'}`)
  }

  const verdict = deriveMyFatoorahVerdict(data.Data)

  // Never trust the invoiceId/purchaseId pairing from the URL alone — confirm
  // the gateway's own record of this invoice references the same purchase
  // (set as CustomerReference/UserDefinedField at SendPayment time).
  const matchesPurchase = verdict.reference === purchaseId
  if (!matchesPurchase) {
    console.error(`[payment/verify] MyFatoorah CustomerReference/UserDefinedField ("${verdict.reference}") does not match purchaseId ("${purchaseId}")`)
  }

  console.log(`[payment/verify] MyFatoorah verdict — InvoiceStatus=${data.Data?.InvoiceStatus} => ${verdict.status}`)

  return { status: verdict.status, matchesPurchase, paymentMethod: verdict.paymentMethod, raw: data.Data ?? null }
}

// ── Tap verification ─────────────────────────────────────────
async function checkTap(chargeId: string, purchaseId: string): Promise<GatewayResult> {
  console.log(`[payment/verify] Tap charge lookup — id=${chargeId} purchaseId=${purchaseId}`)
  const res = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY!}` },
  })
  const charge = await res.json()
  console.log('[payment/verify] Tap charge response', JSON.stringify(charge))

  const ref = charge.metadata?.purchaseId ?? charge.reference?.merchant
  const matchesPurchase = ref === purchaseId
  if (!matchesPurchase) {
    console.error(`[payment/verify] Tap metadata/reference ("${ref}") does not match purchaseId ("${purchaseId}")`)
  }

  const status: GatewayResult['status'] = charge.status === 'CAPTURED' ? 'completed' : charge.status === 'FAILED' ? 'failed' : 'pending'
  console.log(`[payment/verify] Tap verdict — status=${charge.status} => ${status}`)

  return { status, matchesPurchase, paymentMethod: charge.source?.payment_method ?? charge.card?.brand ?? null, raw: charge }
}

// ── Core verify + finalize ───────────────────────────────────
// The gateway reference used to call GetPaymentStatus/charge lookup is
// always read from OUR OWN purchases.payment_ref column — written
// server-side by /api/payment/initiate right after the invoice/charge was
// created, before the customer ever reaches the gateway. This is
// deliberate: redirect query strings and webhook bodies are attacker-
// reachable and gateway-specific (MyFatoorah's redirect param is
// `paymentId`, not `InvoiceId`), so anchoring verification on our own
// opaque, unguessable purchaseId — then asking the gateway directly — is
// the only thing that's actually trustworthy. A URL-supplied key is used
// ONLY as a last-resort fallback if our DB somehow has no ref yet, and
// even then the CustomerReference/UserDefinedField match below still has
// to hold before anything is finalized.
async function verifyAndFinalize(
  purchaseId: string,
  gateway: string,
  sb: any,
  urlFallbackKey: string | null
): Promise<{ status: GatewayStatus }> {
  console.log(`[payment/callback] verifying purchase=${purchaseId} gateway=${gateway}`)

  const { data: purchase, error } = await sb.from('purchases')
    .select('id,status,payment_ref').eq('id', purchaseId).single()

  if (error || !purchase) {
    console.error(`[payment/callback] purchase ${purchaseId} not found — ${error?.message ?? 'no matching row'}`)
    return { status: 'pending' }
  }

  console.log(`[payment/callback] purchase ${purchaseId} loaded — status=${purchase.status} storedRef=${purchase.payment_ref ?? 'none'}`)

  // Idempotency fast-path: retries and duplicate callbacks must never
  // re-process a purchase that's already been finalized. This also means a
  // page refresh on /success or the gateway firing both a redirect AND a
  // webhook for the same payment is always safe — no gateway round-trip
  // needed once we already know the outcome.
  if (purchase.status !== 'pending') {
    // currentPurchaseStatus alone determines the outcome here — decideFinalize
    // returns before ever looking at the gateway argument for a non-pending
    // purchase, so no gateway call is needed just to answer "what happened".
    const decision = decideFinalize(purchase.status, { status: 'pending', matchesPurchase: false, paymentMethod: null, raw: null })
    console.log(`[payment/callback] purchase ${purchaseId} already finalized as ${purchase.status} — idempotent no-op, not re-verifying`)
    return { status: decision.resultStatus }
  }

  let key = purchase.payment_ref as string | null
  let keyType: 'InvoiceId' | 'PaymentId' = 'InvoiceId'
  if (!key && urlFallbackKey) {
    console.warn(`[payment/callback] purchase ${purchaseId} has no stored payment_ref — falling back to gateway-redirect key (unexpected path)`)
    key = urlFallbackKey
    keyType = 'PaymentId'
  }
  if (!key) {
    console.error(`[payment/callback] purchase ${purchaseId} has no payment reference to verify against — cannot proceed`)
    return { status: 'pending' }
  }

  const gatewayResult = gateway === 'tap'
    ? await checkTap(key, purchaseId)
    : await checkMyFatoorah(key, keyType, purchaseId)

  const decision = decideFinalize(purchase.status, gatewayResult)

  if (decision.action === 'reject_mismatch') {
    throw new Error('Payment reference does not match purchase')
  }
  if (decision.action === 'wait_pending') {
    console.log(`[payment/callback] purchase ${purchaseId} still pending at the gateway — no DB update yet`)
    return { status: 'pending' }
  }

  // decision.action === 'apply_update' — the `.eq('status','pending')` guard
  // means only the FIRST caller to reach here for a given purchase actually
  // writes; a concurrent duplicate callback/webhook racing this one just
  // finds 0 rows matched and no-ops.
  const { data: updated, error: updateErr } = await sb.from('purchases')
    .update(decision.update)
    .eq('id', purchaseId).eq('status', 'pending')
    .select('id').maybeSingle()

  if (updateErr) {
    console.error(`[payment/callback] failed to write purchase ${purchaseId} update: ${updateErr.message}`)
  } else if (!updated) {
    console.log(`[payment/callback] purchase ${purchaseId} was already transitioned by a concurrent request — no-op (expected on duplicate callback)`)
  } else {
    console.log(`[payment/callback] purchase ${purchaseId} → status=${decision.resultStatus}${decision.resultStatus === 'completed' ? ` paid_at=${decision.update?.paid_at} payment_method=${decision.update?.payment_method ?? '(unchanged)'}` : ''}`)
  }

  return { status: decision.resultStatus }
}

// ── GET — redirect-based callback (user returns from gateway) ─
export async function GET(request: NextRequest) {
  const params     = request.nextUrl.searchParams
  const purchaseId = params.get('purchaseId')
  const gateway    = params.get('gateway') ?? 'myfatoorah'
  // MyFatoorah appends `paymentId` on redirect; Tap appends `tap_id`. Used
  // only as a fallback lookup key (see verifyAndFinalize) — never as the
  // source of truth for whether the payment succeeded.
  const urlKey     = params.get('paymentId') ?? params.get('tap_id') ?? params.get('id')
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  console.log(`[payment/callback GET] received — purchaseId=${purchaseId ?? 'MISSING'} gateway=${gateway} query="${params.toString()}"`)

  if (!purchaseId) {
    console.error('[payment/callback GET] no purchaseId on the redirect URL — cannot identify which purchase to verify')
    return NextResponse.redirect(`${appUrl}/checkout?error=missing_purchase`)
  }

  const { url: sbUrl, key: sbKey } = getSupabaseServerEnv()
  if (!sbUrl || !sbKey) {
    console.error('[payment/callback GET] Supabase service env not configured — cannot verify payment')
    return NextResponse.redirect(`${appUrl}/checkout?error=callback_error`)
  }
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  try {
    const result = await verifyAndFinalize(purchaseId, gateway, sb, urlKey)
    if (result.status === 'completed') {
      console.log(`[payment/callback GET][redirect] purchase ${purchaseId} PAID — sending customer to /success (never /checkout)`)
      return NextResponse.redirect(`${appUrl}/success?purchaseId=${purchaseId}`)
    }
    console.log(`[payment/callback GET][redirect] purchase ${purchaseId} not completed (status=${result.status}) — sending customer to /checkout with payment_failed`)
    return NextResponse.redirect(`${appUrl}/checkout?error=payment_failed&purchaseId=${purchaseId}`)
  } catch (err: any) {
    console.error(`[payment/callback GET] verification threw for purchase ${purchaseId}: ${err.message}`)
    return NextResponse.redirect(`${appUrl}/checkout?error=callback_error`)
  }
}

// ── POST — webhook from gateway (server-to-server) ────────────
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    console.error('[payment/callback POST] request body is not valid JSON')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const gateway = request.nextUrl.searchParams.get('gateway') ?? 'myfatoorah'

  let purchaseId: string | undefined
  if (gateway === 'tap') {
    purchaseId = body.metadata?.purchaseId ?? body.reference?.merchant
  } else {
    purchaseId = body.UserDefinedField ?? body.CustomerReference
  }

  console.log(`[payment/callback POST] webhook received — gateway=${gateway} purchaseId=${purchaseId ?? 'MISSING'}`)

  if (!purchaseId) {
    console.error('[payment/callback POST] webhook payload has no purchase reference — cannot process', JSON.stringify(body))
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
  }

  const { url: sbUrl, key: sbKey } = getSupabaseServerEnv()
  if (!sbUrl || !sbKey) {
    console.error('[payment/callback POST] Supabase service env not configured — cannot verify payment')
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })
  }
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  try {
    // The webhook body's own InvoiceId/status fields are never trusted — a
    // forged POST could otherwise mark any purchase paid. verifyAndFinalize
    // re-derives the reference from our DB and re-verifies live with the
    // gateway regardless of what this payload claims.
    const result = await verifyAndFinalize(purchaseId, gateway, sb, null)
    console.log(`[payment/callback POST] webhook processed — purchase=${purchaseId} status=${result.status}`)
    return NextResponse.json({ received: true, status: result.status })
  } catch (err: any) {
    console.error(`[payment/callback POST] verification threw for purchase ${purchaseId}: ${err.message}`)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
