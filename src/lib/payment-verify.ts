// Pure decision logic for payment verification/finalization — no network or
// database I/O in this file on purpose, so the exact branching used in
// /api/payment/callback can be unit tested without mocking fetch/Supabase.
// See scripts/test-payment-verify.mjs.

export type GatewayStatus = 'completed' | 'failed' | 'pending'

export interface MyFatoorahTransaction {
  TransactionDate: string
  TransactionStatus: string
  PaymentGateway?: string
}

export interface MyFatoorahVerdict {
  status: GatewayStatus
  reference: string | null
  paymentMethod: string | null
}

// MyFatoorah's InvoiceStatus is only ever 'Paid' or 'Pending' — a failed or
// cancelled attempt still reports 'Pending' at the invoice level. The real
// outcome has to be read off the most recent entry in InvoiceTransactions.
//
// Status strings are compared case-insensitively on purpose: MyFatoorah's
// own documentation is inconsistent about casing between API surfaces (the
// v2 GetPaymentStatus REST endpoint used here documents PascalCase — "Paid",
// "Failed", "Canceled" — while their newer Webhook V2 payloads and v3 API
// use UPPERCASE — "PAID", "FAILED", "CANCELED"). A strict, case-sensitive
// '===' against one exact casing is exactly the kind of thing that silently
// turns a genuinely successful payment into "not completed" the moment
// MyFatoorah changes casing on either surface — so normalize before
// comparing instead of trusting one fixed casing to never drift.
export function deriveMyFatoorahVerdict(data: {
  CustomerReference?: string | null
  UserDefinedField?: string | null
  InvoiceStatus?: string
  InvoiceTransactions?: MyFatoorahTransaction[]
} | null | undefined): MyFatoorahVerdict {
  const reference = data?.CustomerReference ?? data?.UserDefinedField ?? null
  const invoiceStatus = (data?.InvoiceStatus ?? '').toLowerCase()
  const transactions = data?.InvoiceTransactions ?? []
  const latest = [...transactions].sort(
    (a, b) => new Date(b.TransactionDate).getTime() - new Date(a.TransactionDate).getTime()
  )[0]
  const latestStatus = (latest?.TransactionStatus ?? '').toLowerCase()

  let status: GatewayStatus = 'pending'
  if (invoiceStatus === 'paid') status = 'completed'
  else if (latest && ['failed', 'canceled', 'cancelled', 'declined'].includes(latestStatus)) status = 'failed'

  return { status, reference, paymentMethod: latest?.PaymentGateway ?? null }
}

export interface FinalizeUpdate {
  status: GatewayStatus
  paid_at?: string
  payment_method?: string
  transaction_details?: any
}

export interface FinalizeDecision {
  action: 'skip_already_final' | 'reject_mismatch' | 'wait_pending' | 'apply_update'
  resultStatus: GatewayStatus
  update?: FinalizeUpdate
}

// Given the purchase's CURRENT status (as last read from the DB) and the
// gateway's live verdict, decide what — if anything — should happen. Kept
// separate from the DB write so retries/duplicate callbacks/webhooks are
// provably idempotent: once a purchase is 'completed'/'failed'/'refunded',
// every subsequent call for it is a no-op here, regardless of how many
// times the gateway calls back. Final safety against a race between two
// concurrent calls that both read 'pending' is the `.eq('status','pending')`
// compare-and-swap on the actual UPDATE statement in the route — only one of
// them can ever actually flip the row.
export function decideFinalize(
  currentPurchaseStatus: string,
  gateway: { status: GatewayStatus; matchesPurchase: boolean; paymentMethod: string | null; raw: any },
  now: () => string = () => new Date().toISOString()
): FinalizeDecision {
  if (currentPurchaseStatus === 'completed') return { action: 'skip_already_final', resultStatus: 'completed' }
  if (currentPurchaseStatus === 'failed')    return { action: 'skip_already_final', resultStatus: 'failed' }
  if (currentPurchaseStatus === 'refunded')  return { action: 'skip_already_final', resultStatus: 'completed' }

  if (!gateway.matchesPurchase) return { action: 'reject_mismatch', resultStatus: 'pending' }
  if (gateway.status === 'pending') return { action: 'wait_pending', resultStatus: 'pending' }

  const update: FinalizeUpdate = { status: gateway.status }
  if (gateway.status === 'completed') {
    update.paid_at = now()
    if (gateway.paymentMethod) update.payment_method = gateway.paymentMethod
    update.transaction_details = gateway.raw ?? null
  }
  return { action: 'apply_update', resultStatus: gateway.status, update }
}
