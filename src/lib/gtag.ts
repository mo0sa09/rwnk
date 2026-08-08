// Google Analytics 4 (gtag.js) — client-safe event helpers.
//
// GA_MEASUREMENT_ID comes from NEXT_PUBLIC_GA_MEASUREMENT_ID, which Next.js
// inlines into the client bundle at build time — this is the only GA-related
// value that should ever reach the browser. Every helper below is a no-op
// (never throws, never queues) when the ID isn't configured, so analytics
// can never break a page or a purchase — the same "best-effort, never
// fatal" contract src/lib/email.ts uses server-side for Resend.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function callGtag(...args: unknown[]) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag(...args)
}

export function pageview(url: string) {
  if (!GA_MEASUREMENT_ID) return
  callGtag('event', 'page_view', { page_path: url })
}

export type BookLanguage = 'ar' | 'en'

export interface GAItem {
  item_id: string
  item_name: string
  price?: number
  quantity?: number
  book_language?: BookLanguage
}

function trackEvent(name: string, params: Record<string, unknown>) {
  if (!GA_MEASUREMENT_ID) return
  callGtag('event', name, params)
}

export function trackViewItem(item: GAItem, currency: string) {
  trackEvent('view_item', { currency, value: item.price ?? 0, items: [item] })
}

export function trackSelectLanguage(language: BookLanguage) {
  trackEvent('select_language', { book_language: language })
}

export function trackBeginCheckout(item: GAItem, currency: string) {
  trackEvent('begin_checkout', { currency, value: item.price ?? 0, items: [item] })
}

export function trackAddPaymentInfo(item: GAItem, currency: string, paymentMethod: string) {
  trackEvent('add_payment_info', { currency, value: item.price ?? 0, payment_type: paymentMethod, items: [item] })
}

export interface PurchaseEventParams {
  transaction_id: string
  value: number
  currency: string
  item_id: string
  item_name: string
  book_language: BookLanguage
}

// The caller (success page) is solely responsible for only invoking this
// once purchases.status has genuinely been confirmed 'completed' by the
// MyFatoorah verification flow (see /api/payment/callback) — this function
// itself does no verification, it only formats and sends the GA4 event.
export function trackPurchase(p: PurchaseEventParams) {
  trackEvent('purchase', {
    transaction_id: p.transaction_id,
    value: p.value,
    currency: p.currency,
    book_language: p.book_language,
    items: [{ item_id: p.item_id, item_name: p.item_name, price: p.value, quantity: 1, book_language: p.book_language }],
  })
}

export function trackDownloadBook(bookLanguage: BookLanguage, invoiceNumber?: string | null) {
  trackEvent('download_book', { book_language: bookLanguage, invoice_number: invoiceNumber ?? undefined })
}

// Purchase-event dedup guard, keyed per purchaseId in localStorage (survives
// refresh/reload and re-opening the confirmation email link later — a plain
// in-memory ref would not). Never throws: private browsing / storage-quota
// errors just fall back to "not tracked yet", which risks at most one extra
// event, never a crash.
const PURCHASE_TRACK_PREFIX = 'ga_purchase_tracked_'

export function hasTrackedPurchase(purchaseId: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(PURCHASE_TRACK_PREFIX + purchaseId) === '1'
  } catch {
    return false
  }
}

export function markPurchaseTracked(purchaseId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PURCHASE_TRACK_PREFIX + purchaseId, '1')
  } catch {
    /* private browsing / storage disabled — non-fatal */
  }
}
