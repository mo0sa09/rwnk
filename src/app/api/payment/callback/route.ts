import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { deriveMyFatoorahVerdict, decideFinalize, resultStatusToDestination, extractMyFatoorahWebhookPurchaseId, type GatewayStatus } from '@/lib/payment-verify'
import { ensureUserLinked, mintDownloadToken } from '@/lib/payment-access'
import { sendPurchaseConfirmationEmail, sendAdminOrderNotification } from '@/lib/email'
import { getSingletonRow } from '@/lib/db-resilience'

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

interface CompletedPurchaseInfo {
  id: string
  email: string
  invoice_number: string | null
  amount: number
  currency: string
  created_at: string
  product_id: string | null
  book_language: string | null
  customer_name: string | null
}

// Runs the "purchase just became completed, exactly once" side effects:
// mint a download token (pipeline-completeness/audit — see the comment on
// mintDownloadToken), then send the confirmation email. Called from the
// SINGLE branch in verifyAndFinalize where THIS call's own compare-and-swap
// update is what flipped the row — never from the idempotent
// already-completed branches — so a duplicate callback/webhook/page-refresh
// can never re-send the email or re-mint a token for the same purchase.
// Every failure here is caught, logged, and non-fatal: the purchase is
// already 'completed' in the database by the time this runs, and nothing
// in here is allowed to affect that outcome.
async function notifyPurchaseCompleted(sb: any, purchase: CompletedPurchaseInfo, userId: string | null, appUrl: string) {
  await mintDownloadToken(sb, purchase.id, userId)

  try {
    // store_settings must hold exactly one row, but nothing at the DB level
    // enforces that (see getSingletonRow's own comment for the live
    // incident that proved this gap real) — a bare .single() here would
    // silently resolve to settings=null on a duplicate, degrading every
    // confirmation/admin-notification email to generic fallback text with
    // no error logged anywhere. getSingletonRow tolerates the duplicate AND
    // logs it.
    const [{ data: product }, { data: settings, error: settingsErr }] = await Promise.all([
      purchase.product_id
        ? sb.from('products').select('name').eq('id', purchase.product_id).single()
        : Promise.resolve({ data: null }),
      getSingletonRow<{ store_name: string; email: string }>(sb, 'store_settings', 'store_name,email'),
    ])
    if (settingsErr) console.error(`[payment/callback] purchase ${purchase.id} — could not load store_settings for email copy: ${settingsErr.message} (using fallback store name/email)`)

    const language = purchase.book_language === 'en' ? 'en' : 'ar'
    const result = await sendPurchaseConfirmationEmail({
      to: purchase.email,
      language,
      storeName: settings?.store_name ?? 'رَوْنَق',
      productName: product?.name ?? 'الكتاب الرقمي',
      invoiceNumber: purchase.invoice_number ?? purchase.id,
      amount: purchase.amount,
      currency: purchase.currency,
      purchaseDate: purchase.created_at,
      successUrl: `${appUrl}/success?purchaseId=${purchase.id}`,
      supportEmail: settings?.email ?? 'hello@rwnk.co',
    })
    if (!result.ok) {
      console.warn(`[payment/callback] purchase ${purchase.id} — confirmation email not sent (${result.reason}); customer can still reach /success directly`)
    }

    // Admin's own "new order" notification, sent to the store's own contact
    // address (store_settings.email — the only concept of an "admin/owner
    // email" this schema has). Independent try/catch from the customer email
    // above: a failure here must never be attributed to (or block) the
    // customer-facing send, and vice versa.
    const adminResult = await sendAdminOrderNotification({
      to: settings?.email ?? 'hello@rwnk.co',
      storeName: settings?.store_name ?? 'رَوْنَق',
      customerName: purchase.customer_name,
      customerEmail: purchase.email,
      amount: purchase.amount,
      currency: purchase.currency,
      language,
      invoiceNumber: purchase.invoice_number ?? purchase.id,
      purchaseDate: purchase.created_at,
    })
    if (!adminResult.ok) {
      console.warn(`[payment/callback] purchase ${purchase.id} — admin order notification not sent (${adminResult.reason})`)
    }
  } catch (err: any) {
    // Defensive: sendPurchaseConfirmationEmail itself never throws, but the
    // product/settings lookups above could (network hiccup, malformed row).
    // Never let that propagate — this whole function is a best-effort
    // notification step running after the purchase is already completed.
    console.error(`[payment/callback] purchase ${purchase.id} — notifyPurchaseCompleted failed unexpectedly: ${err?.message ?? err}`)
  }
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
  urlFallbackKey: string | null,
  appUrl: string
): Promise<FinalizeResult> {
  console.log(`[payment/callback] verifying purchase=${purchaseId} gateway=${gateway}`)

  // select('*') rather than an explicit column list deliberately: an
  // explicit list that names a column the live database doesn't have yet
  // (book_language, customer_name — both from migrations that may not be
  // applied) fails the ENTIRE query with '42703' (raw Postgres "undefined
  // column"), and this is the core payment-verification query — it must
  // never fail just because one optional column is missing. select('*')
  // simply returns whichever columns actually exist, so any field read
  // below (purchase.book_language, purchase.customer_name, ...) needs to
  // tolerate being undefined — which it already does throughout this file.
  const { data: purchase, error } = await sb.from('purchases').select('*').eq('id', purchaseId).single()

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
    // CRITICAL: never report decision.resultStatus here — that is what the
    // gateway confirmed, NOT what the database actually persisted. A live
    // production audit found this exact bug via a real (schema-mismatch)
    // write failure: the code returned resultStatus='completed' even though
    // the row was still 'pending' in the database, which meant the customer
    // was redirected toward the success destination while
    // purchases.status stayed 'pending' — /success then correctly showed
    // "payment not confirmed" (reading the real row), silently stranding a
    // customer who HAD genuinely paid. Reporting 'pending' here instead is
    // truthful (the DB write did not happen, whatever the gateway said) and
    // safe: 'pending' never routes to /checkout as a failure (see
    // resultStatusToDestination), and the very next retry/webhook delivery
    // for this purchase will attempt the same write again — once the
    // underlying issue is fixed (or was transient), that retry succeeds and
    // the customer reaches their book without ever being charged twice.
    console.error(`[payment/callback] CRITICAL — failed to persist purchase ${purchaseId} as ${decision.resultStatus} (gateway confirmed this outcome, but the DB write itself failed): ${updateErr.message}. Purchase remains 'pending' in the database; this MUST be investigated — check for a schema mismatch (e.g. a column referenced in the update that does not exist on the live table) or an RLS/permissions issue.`)
    return { status: 'pending', userId: null, email: null }
  }
  if (!updated) {
    // Another concurrent call (the GET redirect and the POST webhook racing
    // each other, or two duplicate webhook deliveries) already won the
    // compare-and-swap — THAT call is the one responsible for
    // notifyPurchaseCompleted (email/token), not this one. Re-linking the
    // account here is still safe/idempotent, but sending would double the
    // email.
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
    // This call's own CAS update just flipped pending -> completed — the
    // ONE moment notifyPurchaseCompleted (download token + confirmation
    // email) is allowed to fire for this purchase, ever.
    const linked = await ensureUserLinked(sb, { id: purchaseId, user_id: updated.user_id, email: purchase.email, guest_email: purchase.guest_email })
    await notifyPurchaseCompleted(sb, {
      id: purchaseId,
      email: linked?.email ?? purchase.email,
      invoice_number: purchase.invoice_number,
      amount: purchase.amount,
      currency: purchase.currency,
      created_at: purchase.created_at,
      product_id: purchase.product_id,
      book_language: purchase.book_language ?? null,
      customer_name: purchase.customer_name ?? null,
    }, linked?.userId ?? null, appUrl)
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
    const result = await verifyAndFinalize(purchaseId, gateway, sb, urlKey, appUrl)
    const destination = resultStatusToDestination(result.status)
    const successPath = `/success?purchaseId=${purchaseId}`

    if (destination === 'success') {
      // Auto-login via generateAutoLoginLink is INTENTIONALLY DISABLED as of
      // a live production E2E audit that proved it was actively broken —
      // this is not a cautious default, it was a confirmed, severe bug that
      // could strand a real paying customer:
      //
      // 1. supabase.auth.admin.generateLink({type:'magiclink'}) always
      //    returns an IMPLICIT-flow link — the session tokens come back as a
      //    URL HASH FRAGMENT (`#access_token=...`) on the final redirect,
      //    which browsers never send to a server. Our /auth/callback route
      //    only reads a `?code=` query param (the PKCE flow used by Google
      //    OAuth and email-confirmation links, which — unlike admin-
      //    generated links — are initiated client-side by the Supabase SDK,
      //    which stores a PKCE verifier before redirecting). There is no
      //    code-verifier for an admin-generated link, so GoTrue cannot issue
      //    it as PKCE — /auth/callback can never see these tokens, no
      //    matter what redirectTo is requested.
      // 2. Independently, the live Supabase project's Auth "Site URL" was
      //    found to be a stale `http://localhost:3000` — because our
      //    requested redirectTo isn't on the Redirect URLs allow-list,
      //    Supabase silently substitutes the Site URL instead of erroring,
      //    so the verified link's final destination was observed to be
      //    `http://localhost:3000` (not even /auth/callback) regardless of
      //    what path we asked for.
      //
      // Together this meant a real customer's browser was one gateway
      // redirect away from landing on a dead localhost URL instead of
      // /success. ensureUserLinked() above still runs and still correctly
      // creates/links the account server-side (proven working) — only the
      // "redirect the browser through a sign-in link" step is skipped.
      // /success works fully for a signed-out guest (order summary +
      // instant download, gated by the unguessable purchaseId + a
      // server-side status=completed check), so this is the only currently
      // SAFE behavior. Re-enabling browser auto-login would require a
      // client-side page that parses window.location.hash and calls
      // supabase.auth.setSession() itself, PLUS fixing the Supabase
      // project's Site URL/Redirect URLs in its dashboard — neither of
      // which this fix attempts, since neither is required to reliably get
      // a paying customer to their book.
      console.log(`[payment/callback GET][redirect] purchase ${purchaseId} PAID — sending to /success (auto-login via magic link is disabled; see comment above)`)
      return NextResponse.redirect(`${appUrl}${successPath}`)
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
    // See extractMyFatoorahWebhookPurchaseId in payment-verify.ts — the
    // merchant reference in a real MyFatoorah Webhook V2 payload lives at
    // Data.Invoice.ExternalIdentifier, confirmed against the docs' own raw
    // example payload. Reading Data.Invoice.UserDefinedField instead (an
    // earlier, doc-unverified assumption) resolves to an empty string for
    // every real delivery, which used to 400 every webhook as "missing
    // reference" — invisible until WebhookUrl (below) started guaranteeing
    // delivery on every invoice instead of depending on unverifiable portal
    // configuration.
    purchaseId = extractMyFatoorahWebhookPurchaseId(body)
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    // The webhook body's own InvoiceId/status fields are never trusted — a
    // forged POST could otherwise mark any purchase paid. verifyAndFinalize
    // re-derives the reference from our DB and re-verifies live with the
    // gateway regardless of what this payload claims. Account
    // creation/linking AND the confirmation email/download-token minting run
    // here too (not just on the GET redirect path) so a purchase confirmed
    // asynchronously — after the customer's browser already left — still
    // ends up fully provisioned and the customer still gets their email.
    const result = await verifyAndFinalize(purchaseId, gateway, sb, null, appUrl)
    console.log(`[payment/callback POST] webhook processed — purchase=${purchaseId} status=${result.status}${result.userId ? ` user_id=${result.userId}` : ''}`)
    return NextResponse.json({ received: true, status: result.status })
  } catch (err: any) {
    console.error(`[payment/callback POST] verification threw for purchase ${purchaseId}: ${err.message}`)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
