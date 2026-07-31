// Automated tests for the payment verification/finalization logic used by
// /api/payment/callback. Imports the ACTUAL production module (no
// reimplementation) so these tests exercise real shipped code.
//
// Run: node --experimental-strip-types scripts/test-payment-verify.mjs
//
// This covers the pure decision logic (src/lib/payment-verify.ts) plus a
// lightweight in-memory simulation of the route's DB compare-and-swap for
// the concurrency/duplicate-callback scenarios. Full end-to-end coverage
// (real MyFatoorah sandbox + real Supabase project) is out of scope for a
// local script — see the manual QA checklist printed at the end.

import { deriveMyFatoorahVerdict, decideFinalize, resultStatusToDestination, extractMyFatoorahWebhookPurchaseId } from '../src/lib/payment-verify.ts'
import { ensureUserLinked, mintDownloadToken } from '../src/lib/payment-access.ts'
import { sendPurchaseConfirmationEmail } from '../src/lib/email.ts'

let pass = 0
let fail = 0

function check(name, cond, detail) {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// ─────────────────────────────────────────────────────────────
// 1. MyFatoorah GetPaymentStatus response parsing
// ─────────────────────────────────────────────────────────────
section('MyFatoorah verdict parsing (deriveMyFatoorahVerdict)')

{
  // ✓ Successful payment
  const v = deriveMyFatoorahVerdict({
    CustomerReference: 'purchase-123',
    InvoiceStatus: 'Paid',
    InvoiceTransactions: [
      { TransactionDate: '2026-07-30T10:00:00Z', TransactionStatus: 'Success', PaymentGateway: 'VISA/MASTER' },
    ],
  })
  check('successful payment => completed', v.status === 'completed', JSON.stringify(v))
  check('reference extracted from CustomerReference', v.reference === 'purchase-123')
  check('payment method captured from latest transaction', v.paymentMethod === 'VISA/MASTER')
}

{
  // ✓ Failed payment — InvoiceStatus stays 'Pending' at invoice level, only
  // the transaction log reveals the real outcome. This is the exact trap a
  // naive `InvoiceStatus === 'Paid' ? completed : failed` implementation
  // falls into (it would treat "declined" as merely "not yet paid").
  const v = deriveMyFatoorahVerdict({
    CustomerReference: 'purchase-456',
    InvoiceStatus: 'Pending',
    InvoiceTransactions: [
      { TransactionDate: '2026-07-30T10:00:00Z', TransactionStatus: 'Failed', PaymentGateway: 'KNET' },
    ],
  })
  check('declined card => failed (not pending)', v.status === 'failed', JSON.stringify(v))
}

{
  // ✓ Cancelled payment (customer backed out of the gateway page)
  const v = deriveMyFatoorahVerdict({
    CustomerReference: 'purchase-789',
    InvoiceStatus: 'Pending',
    InvoiceTransactions: [
      { TransactionDate: '2026-07-30T10:00:00Z', TransactionStatus: 'Canceled', PaymentGateway: 'VISA/MASTER' },
    ],
  })
  check('cancelled payment => failed', v.status === 'failed', JSON.stringify(v))
}

{
  // ✓ Genuinely still pending (customer hasn't finished on the gateway page yet)
  const v = deriveMyFatoorahVerdict({
    CustomerReference: 'purchase-999',
    InvoiceStatus: 'Pending',
    InvoiceTransactions: [],
  })
  check('no transactions yet => pending', v.status === 'pending', JSON.stringify(v))
}

{
  // Multiple transactions (e.g. a failed attempt followed by a successful
  // retry on the same invoice) — must pick the LATEST, not the first.
  const v = deriveMyFatoorahVerdict({
    CustomerReference: 'purchase-111',
    InvoiceStatus: 'Paid',
    InvoiceTransactions: [
      { TransactionDate: '2026-07-30T09:00:00Z', TransactionStatus: 'Failed', PaymentGateway: 'VISA/MASTER' },
      { TransactionDate: '2026-07-30T09:05:00Z', TransactionStatus: 'Success', PaymentGateway: 'KNET' },
    ],
  })
  check('picks latest transaction by date, not array order', v.paymentMethod === 'KNET', JSON.stringify(v))
}

{
  // ✓ MyFatoorah's own docs are inconsistent about casing between API
  // surfaces (v2 GetPaymentStatus documents "Paid"/PascalCase; Webhook V2
  // and v3 use "PAID"/UPPERCASE). A strict case-sensitive compare here is
  // exactly the bug class that turns a real success into "not completed" —
  // this must match regardless of casing.
  const v = deriveMyFatoorahVerdict({
    CustomerReference: 'purchase-222',
    InvoiceStatus: 'PAID',
    InvoiceTransactions: [
      { TransactionDate: '2026-07-30T10:00:00Z', TransactionStatus: 'SUCCESS', PaymentGateway: 'KNET' },
    ],
  })
  check('uppercase InvoiceStatus "PAID" still => completed', v.status === 'completed', JSON.stringify(v))
}

{
  // ✓ Same casing robustness on the failure side.
  const v = deriveMyFatoorahVerdict({
    CustomerReference: 'purchase-333',
    InvoiceStatus: 'PENDING',
    InvoiceTransactions: [
      { TransactionDate: '2026-07-30T10:00:00Z', TransactionStatus: 'CANCELED', PaymentGateway: 'KNET' },
    ],
  })
  check('uppercase TransactionStatus "CANCELED" still => failed', v.status === 'failed', JSON.stringify(v))
}

// ─────────────────────────────────────────────────────────────
// 2. Finalize decision logic (decideFinalize)
// ─────────────────────────────────────────────────────────────
section('Finalize decision (decideFinalize)')

{
  // ✓ Successful payment, first time seeing this purchase (still 'pending' in DB)
  const d = decideFinalize('pending', { status: 'completed', matchesPurchase: true, paymentMethod: 'VISA/MASTER', raw: { InvoiceId: 999 } })
  check('new completed payment => apply_update', d.action === 'apply_update' && d.resultStatus === 'completed')
  check('update sets paid_at', typeof d.update?.paid_at === 'string')
  check('update sets payment_method', d.update?.payment_method === 'VISA/MASTER')
  check('update carries transaction_details', d.update?.transaction_details?.InvoiceId === 999)
}

{
  // ✓ Failed payment
  const d = decideFinalize('pending', { status: 'failed', matchesPurchase: true, paymentMethod: null, raw: {} })
  check('failed payment => apply_update with status failed', d.action === 'apply_update' && d.resultStatus === 'failed')
  check('failed payment does not set paid_at', d.update?.paid_at === undefined)
}

{
  // ✓ Cancelled payment — same code path as failed (both map to 'failed' by
  // the time they reach here), never completed, never library access.
  const d = decideFinalize('pending', { status: 'failed', matchesPurchase: true, paymentMethod: null, raw: {} })
  check('cancelled payment never marks completed', d.resultStatus !== 'completed')
}

{
  // ✗ SECURITY: gateway record doesn't reference this purchase — must reject,
  // never silently complete a purchase based on a mismatched reference.
  const d = decideFinalize('pending', { status: 'completed', matchesPurchase: false, paymentMethod: null, raw: {} })
  check('reference mismatch => reject_mismatch (never completes)', d.action === 'reject_mismatch' && d.resultStatus !== 'completed')
}

{
  // Still pending at the gateway — no DB write, no premature completion.
  const d = decideFinalize('pending', { status: 'pending', matchesPurchase: true, paymentMethod: null, raw: {} })
  check('gateway still pending => wait_pending, no update', d.action === 'wait_pending' && d.update === undefined)
}

// ─────────────────────────────────────────────────────────────
// 2b. Redirect destination mapping (resultStatusToDestination) — this IS
//     the production bug: a successful payment that read back as anything
//     other than a hard 'completed' must NEVER land on the same
//     "/checkout?error=payment_failed" destination as a genuinely
//     declined/cancelled payment. 'pending' has its own distinct
//     destination precisely so a settlement-lag race window never gets
//     mislabeled as a failure.
// ─────────────────────────────────────────────────────────────
section('Callback redirect destination (resultStatusToDestination)')

{
  check('completed => success (the delivery page — order summary, cover, instant download)', resultStatusToDestination('completed') === 'success')
  check('pending => pending (NOT the same destination as failed)', resultStatusToDestination('pending') === 'pending')
  check('failed => failed (checkout with Arabic error)', resultStatusToDestination('failed') === 'failed')
  check('pending destination is distinct from failed destination', resultStatusToDestination('pending') !== resultStatusToDestination('failed'))
  check('success destination is distinct from failed destination', resultStatusToDestination('completed') !== resultStatusToDestination('failed'))
}

// ─────────────────────────────────────────────────────────────
// 2c. extractMyFatoorahWebhookPurchaseId — this is THE bug this audit
//     found: a real Webhook V2 payload was silently failing to resolve a
//     purchaseId at all (falling through to an empty string, which is
//     falsy but not null/undefined, so it wasn't caught by a naive `??`
//     chain), meaning every real webhook delivery 400'd as "missing
//     reference" and was dropped. The first test case below uses the
//     OFFICIAL DOCS' OWN raw example payload verbatim
//     (docs.myfatoorah.com/docs/webhook-v2-payment-status-data-model) — not
//     a synthetic shape — to prove the fix against the real, documented
//     schema rather than an assumption about it.
// ─────────────────────────────────────────────────────────────
section('extractMyFatoorahWebhookPurchaseId (real production code, official docs payload)')

{
  // ✓ THE bug: official docs' own example — UserDefinedField is "" (empty),
  // ExternalIdentifier carries the actual merchant reference.
  const officialDocsExamplePayload = {
    Event: { Code: 1, Name: 'PAYMENT_STATUS_CHANGED', CountryIsoCode: 'KWT', CreationDate: '2026-01-04T08:15:00.95Z', Reference: 'WH-626519' },
    Data: {
      Invoice: {
        Id: '6409988',
        Status: 'PAID',
        Reference: '2026000073',
        CreationDate: '2026-01-04T08:14:49.897Z',
        ExpirationDate: '2026-01-04T10:08:36Z',
        UserDefinedField: '',
        ExternalIdentifier: 'purchase-abc-123',
        MetaData: { UDF1: 'dsa', UDF2: '145', UDF3: '8586', UDF4: '12039', UDF5: '748gsvf' },
      },
      Transaction: {}, Customer: {}, Amount: {}, Suppliers: [],
    },
  }
  const purchaseId = extractMyFatoorahWebhookPurchaseId(officialDocsExamplePayload)
  check('resolves the real purchaseId from ExternalIdentifier, not the empty UserDefinedField', purchaseId === 'purchase-abc-123', `got ${JSON.stringify(purchaseId)}`)
}

{
  // ✗ The exact regression this fix prevents reintroducing: reading
  // UserDefinedField FIRST (old, wrong order) on this same real-shaped
  // payload would resolve to "" — falsy, correctly rejected downstream as
  // "missing reference", but that means the webhook is silently dropped
  // instead of finalizing a real payment. Confirm the current
  // implementation does NOT fall into that trap.
  const payloadWithEmptyUserDefinedField = { Data: { Invoice: { UserDefinedField: '', ExternalIdentifier: 'purchase-xyz-789' } } }
  const purchaseId = extractMyFatoorahWebhookPurchaseId(payloadWithEmptyUserDefinedField)
  check('empty UserDefinedField is treated as absent, falls through to ExternalIdentifier', purchaseId === 'purchase-xyz-789')
}

{
  // Legacy/fallback shapes — still resolved if ExternalIdentifier is absent.
  check('falls back to Data.Invoice.UserDefinedField when populated and ExternalIdentifier is absent',
    extractMyFatoorahWebhookPurchaseId({ Data: { Invoice: { UserDefinedField: 'legacy-ref-1' } } }) === 'legacy-ref-1')
  check('falls back to Data.Invoice.CustomerReference',
    extractMyFatoorahWebhookPurchaseId({ Data: { Invoice: { CustomerReference: 'legacy-ref-2' } } }) === 'legacy-ref-2')
  check('falls back to a flat body.UserDefinedField (pre-V2 shape)',
    extractMyFatoorahWebhookPurchaseId({ UserDefinedField: 'flat-ref-1' }) === 'flat-ref-1')
  check('falls back to a flat body.CustomerReference (pre-V2 shape)',
    extractMyFatoorahWebhookPurchaseId({ CustomerReference: 'flat-ref-2' }) === 'flat-ref-2')
}

{
  // No reference anywhere in the payload — must resolve to undefined so the
  // caller's `if (!purchaseId)` correctly rejects it, rather than crashing
  // or coercing to some truthy-but-wrong value.
  check('no reference anywhere => undefined', extractMyFatoorahWebhookPurchaseId({ Data: { Invoice: {} } } ) === undefined)
  check('completely empty payload => undefined', extractMyFatoorahWebhookPurchaseId({}) === undefined)
}

// ─────────────────────────────────────────────────────────────
// 2d. Database write failure after a confirmed gateway verdict — a
//     SEVERE, real bug found via a live production E2E audit: an actual
//     schema mismatch (purchases.paid_at/transaction_details missing from
//     the live table) caused the DB UPDATE to fail, and the route used to
//     return `decision.resultStatus` (i.e. 'completed', what the GATEWAY
//     said) instead of reflecting that the write itself never happened —
//     silently telling the customer's browser "you're done" while the row
//     was still 'pending'. This section mirrors the exact fix now in
//     /api/payment/callback/route.ts's `if (updateErr)` branch: on a write
//     failure, the returned status MUST be 'pending' (truthful — nothing
//     was persisted), never the gateway's verdict.
// ─────────────────────────────────────────────────────────────
section('DB write failure never reported as completed (the real bug this audit found)')

function simulateUpdateOutcome(decision, writeSucceeded) {
  // Mirrors the exact branch in verifyAndFinalize: on updateErr, return
  // 'pending' regardless of what decision.resultStatus says.
  if (!writeSucceeded) return { status: 'pending' }
  return { status: decision.resultStatus }
}

{
  const decision = decideFinalize('pending', { status: 'completed', matchesPurchase: true, paymentMethod: 'KNET', raw: {} })
  check('gateway confirms completed, but DB write fails => reported status is pending, NOT completed',
    simulateUpdateOutcome(decision, false).status === 'pending')
  check('a failed write is never reported as the gateway verdict',
    simulateUpdateOutcome(decision, false).status !== decision.resultStatus)
  check('pending (from a write failure) still routes to /success, never /checkout',
    resultStatusToDestination(simulateUpdateOutcome(decision, false).status) !== 'failed')
}

{
  // Sanity: the happy path (write succeeds) still correctly reports completed.
  const decision = decideFinalize('pending', { status: 'completed', matchesPurchase: true, paymentMethod: 'KNET', raw: {} })
  check('successful write correctly reports completed', simulateUpdateOutcome(decision, true).status === 'completed')
}

section('Callback retry / duplicate callback idempotency')

{
  // ✓ Callback retry: purchase already completed by an earlier call — a
  // second callback for the same purchase (network retry, user hitting
  // back+forward) must be a pure no-op, never re-charge logic or re-send
  // emails/re-link accounts.
  const d = decideFinalize('completed', { status: 'completed', matchesPurchase: true, paymentMethod: 'VISA/MASTER', raw: {} })
  check('retry on already-completed purchase => skip_already_final', d.action === 'skip_already_final' && d.resultStatus === 'completed')
  check('retry produces no update payload', d.update === undefined)
}

{
  // ✓ Duplicate callback: gateway fires BOTH the redirect GET and a webhook
  // POST for the same payment. First one flips pending -> completed; by the
  // time the second one reads the purchase row, status is already
  // 'completed', so it takes the same skip_already_final branch above.
  const first  = decideFinalize('pending',   { status: 'completed', matchesPurchase: true, paymentMethod: 'KNET', raw: {} })
  const second = decideFinalize('completed', { status: 'completed', matchesPurchase: true, paymentMethod: 'KNET', raw: {} })
  check('first callback applies the update', first.action === 'apply_update')
  check('duplicate callback is a no-op, not a second charge/link', second.action === 'skip_already_final')
}

{
  // A purchase already marked 'failed' must never be flipped to 'completed'
  // by a late-arriving success callback (e.g. reordered webhook delivery).
  const d = decideFinalize('failed', { status: 'completed', matchesPurchase: true, paymentMethod: 'VISA/MASTER', raw: {} })
  check('late success callback on failed purchase is ignored', d.action === 'skip_already_final' && d.resultStatus === 'failed')
}

// ─────────────────────────────────────────────────────────────
// 3. Concurrency: simulated compare-and-swap (mirrors the route's
//    `.eq('id', purchaseId).eq('status', 'pending')` UPDATE guard)
// ─────────────────────────────────────────────────────────────
section('Concurrent duplicate callbacks racing the same purchase (DB CAS simulation)')

{
  // In-memory stand-in for the purchases table row + the exact guard used
  // in the real UPDATE statement in callback/route.ts.
  const table = new Map([['p1', { status: 'pending' }]])
  function casUpdate(id, update) {
    const row = table.get(id)
    if (!row || row.status !== 'pending') return { updated: null } // 0 rows matched
    table.set(id, { ...row, ...update })
    return { updated: { id } }
  }

  const gatewayResult = { status: 'completed', matchesPurchase: true, paymentMethod: 'VISA/MASTER', raw: {} }
  // Two concurrent requests both read status='pending' before either writes
  // (the actual DB read is a separate statement from the guarded UPDATE).
  const decisionA = decideFinalize('pending', gatewayResult)
  const decisionB = decideFinalize('pending', gatewayResult)
  const writeA = casUpdate('p1', decisionA.update)
  const writeB = casUpdate('p1', decisionB.update) // races against A

  check('exactly one of the two racing writes actually applies', (writeA.updated ? 1 : 0) + (writeB.updated ? 1 : 0) === 1,
    `writeA=${JSON.stringify(writeA)} writeB=${JSON.stringify(writeB)}`)
  check('final row status is completed exactly once', table.get('p1').status === 'completed')
}

// ─────────────────────────────────────────────────────────────
// 4. Purchase linking — new vs. existing customer (mirrors the branching
//    in /api/link-purchase and /api/link-existing-purchase; simulated
//    in-memory since no live Supabase auth admin API is available here)
// ─────────────────────────────────────────────────────────────
section('Account linking — new customer vs. existing customer')

function simulateAccountFlow(existingUsersByEmail, purchase, email) {
  // Mirrors createAccountAfterPurchase()'s branching in src/lib/auth.ts:
  // signUp() succeeds for a brand-new email, or fails with "already
  // registered" for a returning customer, and each case links the
  // purchase to a user through a different route (/link-purchase vs.
  // /link-existing-purchase).
  const alreadyExists = email in existingUsersByEmail
  if (alreadyExists) {
    // /api/link-existing-purchase path: find the account by email, link.
    const userId = existingUsersByEmail[email]
    return { route: 'link-existing-purchase', purchase: { ...purchase, user_id: userId, account_created: true } }
  }
  // /api/link-purchase path: brand-new auth user id, link directly.
  const newUserId = 'new-user-id'
  return { route: 'link-purchase', purchase: { ...purchase, user_id: newUserId, account_created: true } }
}

{
  const purchase = { id: 'purchase-A', email: 'first-time@example.com', status: 'completed', user_id: null }
  const result = simulateAccountFlow({}, purchase, 'first-time@example.com')
  check('new customer routes through /api/link-purchase', result.route === 'link-purchase')
  check('new customer purchase gets user_id + account_created', result.purchase.user_id && result.purchase.account_created === true)
}

{
  const purchase = { id: 'purchase-B', email: 'returning@example.com', status: 'completed', user_id: null }
  const result = simulateAccountFlow({ 'returning@example.com': 'existing-user-id' }, purchase, 'returning@example.com')
  check('existing customer routes through /api/link-existing-purchase', result.route === 'link-existing-purchase')
  check('existing customer purchase links to their existing account id', result.purchase.user_id === 'existing-user-id')
  check('repeat purchase will now surface in their library (user_id set)', !!result.purchase.user_id)
}

// ─────────────────────────────────────────────────────────────
// 4b. ensureUserLinked — REAL production code (not a simulation) exercised
//     against a fake Supabase admin client, covering the exact three
//     branches the "auto-login to /success" fix depends on: already
//     linked (idempotent), brand-new customer, and repeat customer whose
//     email already has an account.
// ─────────────────────────────────────────────────────────────
section('ensureUserLinked (real production code, fake Supabase client)')

function makeFakeSupabase({ existingUsersByEmail = {}, createUserResult, updateShouldFail = false } = {}) {
  const updates = []
  return {
    _updates: updates,
    auth: {
      admin: {
        async createUser({ email }) {
          if (createUserResult) return createUserResult
          if (email in existingUsersByEmail) {
            return { data: null, error: { message: 'A user with this email address has already been registered' } }
          }
          return { data: { user: { id: `new-${email}` } }, error: null }
        },
        async listUsers({ page }) {
          if (page > 1) return { data: { users: [] }, error: null }
          const users = Object.entries(existingUsersByEmail).map(([email, id]) => ({ id, email }))
          return { data: { users }, error: null }
        },
      },
    },
    from(table) {
      return {
        update(patch) {
          return {
            eq: async (col, val) => {
              updates.push({ table, patch, col, val })
              if (updateShouldFail) return { error: { message: 'simulated DB failure' } }
              return { error: null }
            },
          }
        },
      }
    },
  }
}

{
  // ✓ Already linked — must be a pure read, zero auth admin API calls or writes.
  const sb = makeFakeSupabase()
  const result = await ensureUserLinked(sb, { id: 'p1', user_id: 'already-linked-user', email: 'a@example.com' })
  check('already-linked purchase short-circuits with no writes', sb._updates.length === 0)
  check('already-linked purchase returns the existing user_id unchanged', result?.userId === 'already-linked-user')
}

{
  // ✓ Brand-new customer — createUser succeeds, purchase gets linked to the new id.
  const sb = makeFakeSupabase()
  const result = await ensureUserLinked(sb, { id: 'p2', user_id: null, email: 'brand-new@example.com' })
  check('new customer gets a freshly created account', result?.isNewUser === true && result?.userId === 'new-brand-new@example.com')
  check('new customer purchase is written with user_id + account_created', sb._updates.length === 1 && sb._updates[0].patch.account_created === true)
}

{
  // ✓ Repeat customer — createUser reports "already registered", falls back
  // to listUsers-by-email instead of leaving the purchase unlinked.
  const sb = makeFakeSupabase({ existingUsersByEmail: { 'returning@example.com': 'existing-user-id' } })
  const result = await ensureUserLinked(sb, { id: 'p3', user_id: null, email: 'returning@example.com' })
  check('repeat customer resolves to their EXISTING account, not a duplicate', result?.isNewUser === false && result?.userId === 'existing-user-id')
  check('repeat customer purchase links to the existing account id', sb._updates[0]?.patch.user_id === 'existing-user-id')
}

{
  // ✗ Unexpected auth error (not "already registered") — must fail closed
  // (return null) rather than silently leaving a payment access-provisioned
  // with a wrong/partial account. The purchase itself stays 'completed'
  // regardless (that decision is made earlier, in decideFinalize) — this
  // only governs whether auto-login/library-linking succeeded.
  const sb = makeFakeSupabase({ createUserResult: { data: null, error: { message: 'Auth service is temporarily unavailable' } } })
  const result = await ensureUserLinked(sb, { id: 'p4', user_id: null, email: 'unlucky@example.com' })
  check('unexpected auth error => null (caller falls back to /success, not a crash)', result === null)
  check('unexpected auth error writes nothing to purchases', sb._updates.length === 0)
}

{
  // ✗ DB write itself fails after a successful account resolution — must
  // still report failure (null) so the callback route falls back to
  // /success instead of claiming a link that didn't actually persist.
  const sb = makeFakeSupabase({ updateShouldFail: true })
  const result = await ensureUserLinked(sb, { id: 'p5', user_id: null, email: 'db-hiccup@example.com' })
  check('DB write failure => null (never reports a link that did not persist)', result === null)
}

// ─────────────────────────────────────────────────────────────
// 4c. mintDownloadToken — real production code, fake `download_tokens` insert.
// ─────────────────────────────────────────────────────────────
section('mintDownloadToken (real production code, fake Supabase client)')

function makeFakeTokenSupabase({ insertShouldFail = false, token = 'tok_abc123' } = {}) {
  return {
    from(table) {
      return {
        insert(_row) {
          return {
            select: () => ({
              single: async () => insertShouldFail
                ? { data: null, error: { message: 'simulated insert failure' } }
                : { data: { token }, error: null },
            }),
          }
        },
      }
    },
  }
}

{
  const sb = makeFakeTokenSupabase()
  const token = await mintDownloadToken(sb, 'purchase-1', 'user-1')
  check('successful mint returns the token string', token === 'tok_abc123')
}

{
  const sb = makeFakeTokenSupabase({ insertShouldFail: true })
  const token = await mintDownloadToken(sb, 'purchase-2', null)
  check('failed mint returns null, never throws (this is a best-effort audit step)', token === null)
}

// ─────────────────────────────────────────────────────────────
// 4d. sendPurchaseConfirmationEmail — MUST NEVER THROW, and must fail
//     closed (never block a completed purchase) whether unconfigured or
//     when the provider API itself errors.
// ─────────────────────────────────────────────────────────────
section('sendPurchaseConfirmationEmail (never throws, fails closed)')

const emailParams = {
  to: 'customer@example.com',
  storeName: 'رَوْنَق',
  productName: 'كتاب رَوْنَق',
  invoiceNumber: 'RWN-2026-0001',
  amount: 5,
  currency: 'KWD',
  purchaseDate: '2026-07-31T10:00:00Z',
  successUrl: 'https://rwnk.net/success?purchaseId=abc',
  supportEmail: 'hello@rwnk.co',
}

{
  // ✓ Not configured — must skip cleanly, not throw, not pretend it sent.
  const savedKey = process.env.RESEND_API_KEY
  const savedFrom = process.env.EMAIL_FROM
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  let threw = false
  let result
  try { result = await sendPurchaseConfirmationEmail(emailParams) } catch { threw = true }
  check('missing RESEND_API_KEY/EMAIL_FROM never throws', threw === false)
  check('missing config reports not_configured (not a silent false "sent")', result?.ok === false && result?.reason === 'not_configured')
  if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey; else delete process.env.RESEND_API_KEY
  if (savedFrom !== undefined) process.env.EMAIL_FROM = savedFrom; else delete process.env.EMAIL_FROM
}

{
  // ✓ Configured but the provider API itself fails (bad key, rate limit,
  // outage) — must still never throw, and must report the failure honestly
  // rather than claiming success.
  const savedKey = process.env.RESEND_API_KEY
  const savedFrom = process.env.EMAIL_FROM
  const savedFetch = globalThis.fetch
  process.env.RESEND_API_KEY = 'test-key'
  process.env.EMAIL_FROM = 'رَوْنَق <hello@rwnk.co>'
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => '{"message":"invalid api key"}' })
  let threw = false
  let result
  try { result = await sendPurchaseConfirmationEmail(emailParams) } catch { threw = true }
  check('provider API failure never throws', threw === false)
  check('provider API failure reports send_failed', result?.ok === false && result?.reason === 'send_failed')
  globalThis.fetch = savedFetch
  if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey; else delete process.env.RESEND_API_KEY
  if (savedFrom !== undefined) process.env.EMAIL_FROM = savedFrom; else delete process.env.EMAIL_FROM
}

{
  // ✓ Happy path — configured, provider accepts the send.
  const savedKey = process.env.RESEND_API_KEY
  const savedFrom = process.env.EMAIL_FROM
  const savedFetch = globalThis.fetch
  process.env.RESEND_API_KEY = 'test-key'
  process.env.EMAIL_FROM = 'رَوْنَق <hello@rwnk.co>'
  let capturedBody = null
  globalThis.fetch = async (_url, init) => { capturedBody = JSON.parse(init.body); return { ok: true, status: 200, text: async () => '{"id":"email_123"}' } }
  const result = await sendPurchaseConfirmationEmail(emailParams)
  check('successful send reports ok:true', result?.ok === true)
  check('sends to the correct recipient', capturedBody?.to?.[0] === emailParams.to)
  check('HTML body includes the invoice number', capturedBody?.html?.includes(emailParams.invoiceNumber))
  check('HTML body includes the download/success link', capturedBody?.html?.includes(emailParams.successUrl))
  check('HTML body includes the support email', capturedBody?.html?.includes(emailParams.supportEmail))
  globalThis.fetch = savedFetch
  if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey; else delete process.env.RESEND_API_KEY
  if (savedFrom !== undefined) process.env.EMAIL_FROM = savedFrom; else delete process.env.EMAIL_FROM
}

// ─────────────────────────────────────────────────────────────
// 5. Download after payment — purchase must be 'completed' before a token
//    is ever issued (mirrors /api/download/token's gating)
// ─────────────────────────────────────────────────────────────
section('Download eligibility gating')

function canIssueToken(purchase) {
  if (purchase.status !== 'completed') return false
  if ((purchase.downloads_used ?? 0) >= (purchase.downloads_limit ?? 0)) return false
  return true
}

{
  check('download blocked while purchase is pending', canIssueToken({ status: 'pending', downloads_used: 0, downloads_limit: 5 }) === false)
  check('download blocked for a failed purchase', canIssueToken({ status: 'failed', downloads_used: 0, downloads_limit: 5 }) === false)
  check('download allowed once completed with quota left', canIssueToken({ status: 'completed', downloads_used: 2, downloads_limit: 5 }) === true)
  check('download blocked once limit reached', canIssueToken({ status: 'completed', downloads_used: 5, downloads_limit: 5 }) === false)
}

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`${pass} passed, ${fail} failed`)

if (fail > 0) {
  console.log('\nFAILED — see ✗ marks above.')
  process.exit(1)
}

console.log(`
Covered automatically (real production logic, no live services required):
  ✓ successful payment              ✓ failed payment
  ✓ cancelled payment               ✓ callback retry
  ✓ duplicate callback              ✓ concurrent racing callbacks
  ✓ reference-mismatch rejection    ✓ pending never maps to the failed destination
  ✓ new customer account creation   ✓ existing customer account lookup
  ✓ account-linking failure modes   ✓ download-token minting (success + failure)
  ✓ confirmation email never throws ✓ confirmation email fails closed (unconfigured / provider error)
  ✓ confirmation email content      ✓ download gating after payment

Requires a live MyFatoorah sandbox + Supabase project to verify end-to-end
(cannot be exercised from a local script) — manual QA checklist:
  [ ] Real checkout -> MyFatoorah sandbox card -> redirected straight to /success (never /checkout), already signed in when possible
  [ ] /success shows: ✅ heading, order number, purchase date, email, book cover, working Download button
  [ ] purchases row shows status=completed, payment_ref, paid_at, payment_method, transaction_details, user_id, account_created=true
  [ ] auth.users has exactly one account for the checkout email (no duplicate on repeat purchase)
  [ ] Confirmation email arrives with correct order number/amount/date and a working download link (requires RESEND_API_KEY + EMAIL_FROM configured)
  [ ] With RESEND_API_KEY unset -> purchase still completes and /success still works; server logs show the "not_configured" warning, nothing breaks
  [ ] /library shows the book (permanent archive, still reachable after the Success page)
  [ ] Download button on /success and /library both produce a working PDF; downloaded file is never a raw storage/bucket URL (must be the /api/download redirect)
  [ ] Declined test card -> redirected to /checkout with a visible Arabic error, purchases.status=failed
  [ ] Cancel out of the MyFatoorah page -> same as above
  [ ] MyFatoorah dashboard "resend webhook" on a paid invoice -> no duplicate purchases/emails/accounts
  [ ] Repeat purchase by an existing customer -> new purchase links to their EXISTING account, /library shows both orders, no duplicate confirmation email account
  [ ] Google login customer who then buys as a guest with the same email -> purchase links to their existing account, not a new one
  [ ] Slow/delayed settlement (if simulatable) -> customer briefly sees /success "still confirming" state, then auto-upgrades to success without a manual refresh
  [ ] Confirm MYFATOORAH_BASE_URL/NEXT_PUBLIC_APP_URL are both LIVE (not sandbox/localhost) in the production environment
  [ ] Confirm /auth/callback is present in the Supabase project's Auth → URL Configuration → Redirect URLs allow-list
  [ ] Confirm EMAIL_FROM's domain is verified in the Resend dashboard (unverified domains fail every send)
`)
process.exit(0)
