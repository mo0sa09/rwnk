import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { deriveMyFatoorahVerdict, decideFinalize, resultStatusToDestination, type GatewayStatus } from '@/lib/payment-verify'
import { ensureUserLinked, generateLibraryMagicLink } from '@/lib/payment-access'

export const dynamic = 'force-dynamic'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface GatewayResult {
  status: GatewayStatus
  matchesPurchase: boolean
  paymentMethod: string | null
  raw: any
}

// ── MyFatoorah verification ──────────────────────────────────
// GetPaymentStatus accepts KeyType 'InvoiceId' (what we store at
// /api/payment/initiate time) or 'PaymentId' (what MyFatoorah appends to
// BOTH CallBackUrl and ErrorUrl on redirect — note: NOT 'InvoiceId', that
// param name never appears on the redirect at all, which was one root cause
// of the "charged but bounced back to checkout" bug). The other cause was
// ErrorUrl skipping this verification path entirely and going straight to
// the checkout error banner — see the comment on `errorUrl` in
// /api/payment/initiate/route.ts. Both are now fixed: this endpoint is the
// single source of truth for the outcome regardless of which URL MyFatoorah
// redirected to.
async function checkMyFatoorah(key: string, keyType: 'InvoiceId' | 'PaymentId', purchaseId: string): Promise<GatewayResult> {
  const apiKey  = process.env.MYFATOORAH_API_KEY!
  const baseUrl = process.env.MYFATOORAH_BASE_URL ?? 'https://apitest.myfatoorah.com'

  console.log(`[payment/verify] MyFatoorah GetPaymentStatus request — baseUrl=${baseUrl} Key=${key} KeyType=${keyType} purchaseId=${purchaseId}`)

  const res = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ Key: key, KeyType: keyType }),
  })

  const rawBody = await res.text()
  let data: any
  try {
    data = JSON.parse(rawBody)
  } catch {
    console.error(`[payment/verify] MyFatoorah GetPaymentStatus returned non-JSON (HTTP ${res.status}) for purchase ${purchaseId} — likely wrong MYFATOORAH_BASE_URL or an auth/proxy failure. Raw body: ${rawBody.slice(0, 500)}`)
    throw new Error(`MyFatoorah status check returned a non-JSON response (HTTP ${res.status})`)
  }
  console.log(`[payment/verify] MyFatoorah GetPaymentStatus response — HTTP ${res.status} IsSuccess=${data.IsSuccess}`, JSON.stringify(data))

  if (!res.ok) {
    console.error(`[payment/verify] MyFatoorah GetPaymentStatus HTTP ${res.status} for purchase ${purchaseId} — ${data.Message ?? 'no message'}`)
  }
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

// Bank/KNET settlement on MyFatoorah's side can lag the redirect by a
// second or two — GetPaymentStatus called the instant the customer's
// browser lands back on our callback can still legitimately read
// InvoiceStatus=Pending for a payment that finishes settling moments later.
// Retrying a SHORT, bounded number of times only while the verdict is
// 'pending' (never for a definitive 'failed' — a declined transaction
// doesn't become paid by waiting) closes that race window instead of
// mislabeling a payment that was seconds away from confirming.
async function checkMyFatoorahWithRetry(key: string, keyType: 'InvoiceId' | 'PaymentId', purchaseId: string): Promise<GatewayResult> {
  const attempts = 3
  const delayMs = 1200
  let result = await checkMyFatoorah(key, keyType, purchaseId)
  for (let i = 1; i < attempts && result.status === 'pending'; i++) {
    console.log(`[payment/verify] purchase ${purchaseId} still pending on attempt ${i}/${attempts - 1} retries — waiting ${delayMs}ms before re-checking (settlement lag, not a failure)`)
    await sleep(delayMs)
    result = await checkMyFatoorah(key, keyType, purchaseId)
  }
  return result
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

interface FinalizeResult {
  status: GatewayStatus
  userId: string | null
  email: string | null
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
): Promise<FinalizeResult> {
  console.log(`[payment/callback] verifying purchase=${purchaseId} gateway=${gateway}`)

  const { data: purchase, error } = await sb.from('purchases')
    .select('id,status,payment_ref,email,guest_email,user_id').eq('id', purchaseId).single()

  if (error || !purchase) {
    console.error(`[payment/callback] purchase ${purchaseId} not found — ${error?.message ?? 'no matching row'}`)
    return { status: 'pending', userId: null, email: null }
  }

  console.log(`[payment/callback] purchase ${purchaseId} loaded — status=${purchase.status} storedRef=${purchase.payment_ref ?? 'none'} user_id=${purchase.user_id ?? 'none'}`)

  // Idempotency fast-path: retries and duplicate callbacks must never
  // re-process a purchase that's already been finalized. This also means a
  // page refresh on /success or the gateway firing both a redirect AND a
  // webhook for the same payment is always safe — no gateway round-trip
  // needed once we already know the outcome. Account linking is retried
  // here regardless (see below) in case a PREVIOUS completion left the
  // purchase completed but account provisioning itself failed transiently.
  if (purchase.status !== 'pending') {
    const decision = decideFinalize(purchase.status, { status: 'pending', matchesPurchase: false, paymentMethod: null, raw: null })
    console.log(`[payment/callback] purchase ${purchaseId} already finalized as ${purchase.status} — idempotent no-op, not re-verifying with the gateway`)
    if (decision.resultStatus === 'completed') {
      const linked = await ensureUserLinked(sb, purchase)
      return { status: 'completed', userId: linked?.userId ?? purchase.user_id ?? null, email: linked?.email ?? purchase.email ?? null }
    }
    return { status: decision.resultStatus, userId: null, email: null }
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
    return { status: 'pending', userId: null, email: null }
  }

  const gatewayResult = gateway === 'tap'
    ? await checkTap(key, purchaseId)
    : await checkMyFatoorahWithRetry(key, keyType, purchaseId)

  const decision = decideFinalize(purchase.status, gatewayResult)

  if (decision.action === 'reject_mismatch') {
    throw new Error('Payment reference does not match purchase')
  }
  if (decision.action === 'wait_pending') {
    console.log(`[payment/callback] purchase ${purchaseId} still pending at the gateway after retries — no DB update yet, not a failure`)
    return { status: 'pending', userId: null, email: null }
  }

  // decision.action === 'apply_update' — the `.eq('status','pending')` guard
  // means only the FIRST caller to reach here for a given purchase actually
  // writes; a concurrent duplicate callback/webhook racing this one just
  // finds 0 rows matched and no-ops.
  const { data: updated, error: updateErr } = await sb.from('purchases')
    .update(decision.update)
    .eq('id', purchaseId).eq('status', 'pending')
    .select('id,user_id').maybeSingle()

  if (updateErr) {
    console.error(`[payment/callback] failed to write purchase ${purchaseId} update: ${updateErr.message}`)
    return { status: decision.resultStatus, userId: null, email: null }
  }
  if (!updated) {
    console.log(`[payment/callback] purchase ${purchaseId} was already transitioned by a concurrent request — re-reading its final state`)
    const { data: settled } = await sb.from('purchases').select('status,user_id,email').eq('id', purchaseId).single()
    if (settled?.status === 'completed') {
      const linked = await ensureUserLinked(sb, { id: purchaseId, user_id: settled.user_id, email: settled.email })
      return { status: 'completed', userId: linked?.userId ?? settled.user_id ?? null, email: linked?.email ?? settled.email ?? null }
    }
    return { status: (settled?.status as GatewayStatus) ?? decision.resultStatus, userId: null, email: null }
  }

  console.log(`[payment/callback] purchase ${purchaseId} → status=${decision.resultStatus}${decision.resultStatus === 'completed' ? ` paid_at=${decision.update?.paid_at} payment_method=${decision.update?.payment_method ?? '(unchanged)'}` : ''}`)

  if (decision.resultStatus === 'completed') {
    const linked = await ensureUserLinked(sb, { id: purchaseId, user_id: updated.user_id, email: purchase.email, guest_email: purchase.guest_email })
    return { status: 'completed', userId: linked?.userId ?? null, email: linked?.email ?? purchase.email ?? null }
  }

  return { status: decision.resultStatus, userId: null, email: null }
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
    const destination = resultStatusToDestination(result.status)

    if (destination === 'library') {
      // Send the browser straight through Supabase's own sign-in link
      // verification (the same mechanism Google login and password-reset
      // already use via /auth/callback) so it lands on /library already
      // authenticated — no manual "create a password" step, and NEVER a
      // bounce to /checkout for a payment that actually succeeded.
      const magicLink = result.email ? await generateLibraryMagicLink(sb, result.email, appUrl) : null
      if (magicLink) {
        console.log(`[payment/callback GET][redirect] purchase ${purchaseId} PAID — auto-login link minted, sending customer straight to /library`)
        return NextResponse.redirect(magicLink)
      }
      // Account/magic-link provisioning failed for some reason (e.g. auth
      // admin API hiccup) — the purchase is still genuinely completed and
      // must never be shown as a failure. Fall back to /success, which lets
      // the customer set a password manually and still reach their book;
      // this is strictly a degraded UX path, never a lost sale.
      console.warn(`[payment/callback GET][redirect] purchase ${purchaseId} PAID but auto-login could not be provisioned — falling back to /success (never /checkout)`)
      return NextResponse.redirect(`${appUrl}/success?purchaseId=${purchaseId}`)
    }

    if (destination === 'pending') {
      // Genuinely undetermined (or the bounded retry above still hasn't
      // seen a final settlement) — this is explicitly NOT the same as
      // "failed". /success already renders an honest "لم نستلم تأكيد الدفع
      // بعد" state for exactly this case instead of a hard failure banner,
      // and money that was actually deducted is never silently written off
      // as payment_failed just because MyFatoorah hadn't finished settling
      // yet at the moment of redirect. /success itself now polls in the
      // background and upgrades to the success view automatically once
      // settlement completes, without the customer having to do anything.
      console.log(`[payment/callback GET][redirect] purchase ${purchaseId} still pending — sending to /success (pending state), NOT /checkout`)
      return NextResponse.redirect(`${appUrl}/success?purchaseId=${purchaseId}`)
    }

    console.log(`[payment/callback GET][redirect] purchase ${purchaseId} failed/declined/cancelled — sending customer to /checkout with an Arabic error`)
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
    // MyFatoorah's portal-configured Webhook (separate from the CallBackUrl/
    // ErrorUrl redirect handled by the GET handler above) sends an object-
    // based payload: { Event: {...}, Data: { Invoice: { UserDefinedField,
    // Id, ... }, Transaction: { PaymentId, ... }, ... } } — the reference we
    // set at SendPayment time lives at Data.Invoice.UserDefinedField, NOT at
    // the payload root. The flat body.UserDefinedField/body.CustomerReference
    // check below is kept only as a fallback for older/legacy webhook
    // configurations that still POST a flat shape — without it, every real
    // MyFatoorah webhook call 400'd with "Missing reference" and was
    // silently dropped, meaning any payment finalized asynchronously
    // (a delayed KNET/bank confirmation after the customer's browser already
    // left, or the customer closing the tab before the CallBackUrl redirect
    // completed) never got marked paid even though it had succeeded.
    purchaseId =
      body.Data?.Invoice?.UserDefinedField ??
      body.Data?.Invoice?.CustomerReference ??
      body.UserDefinedField ??
      body.CustomerReference
  }

  console.log(`[payment/callback POST] webhook received — gateway=${gateway} purchaseId=${purchaseId ?? 'MISSING'} body=${JSON.stringify(body).slice(0, 1000)}`)

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
    // gateway regardless of what this payload claims. Account
    // creation/linking runs here too (not just on the GET redirect path) so
    // a purchase confirmed asynchronously — after the customer's browser
    // already left — still ends up fully provisioned and library-ready.
    const result = await verifyAndFinalize(purchaseId, gateway, sb, null)
    console.log(`[payment/callback POST] webhook processed — purchase=${purchaseId} status=${result.status}${result.userId ? ` user_id=${result.userId}` : ''}`)
    return NextResponse.json({ received: true, status: result.status })
  } catch (err: any) {
    console.error(`[payment/callback POST] verification threw for purchase ${purchaseId}: ${err.message}`)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
