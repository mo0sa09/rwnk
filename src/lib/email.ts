// Purchase confirmation email — sent once, right after a purchase transitions
// to 'completed' (see /api/payment/callback). Deliberately provider-light:
// a single fetch() call to Resend's HTTP API rather than an SDK dependency,
// since HTTP-based email works reliably from any serverless runtime (unlike
// SMTP, which many serverless platforms block outbound).
//
// MUST NEVER THROW. Email delivery is explicitly a best-effort side effect
// of a completed payment, never a condition of it — every function here
// catches its own failures, logs them with enough detail to diagnose from
// server logs alone, and returns a result object instead of raising. The
// caller in the callback route does not (and must not) treat a failed send
// as anything other than a log line; the Success page is the guaranteed
// delivery path regardless of whether this email ever arrives.

export type EmailLanguage = 'ar' | 'en'

export interface PurchaseEmailParams {
  to: string
  language: EmailLanguage
  storeName: string
  productName: string
  invoiceNumber: string
  amount: number
  currency: string
  purchaseDate: string // ISO string
  successUrl: string
  supportEmail: string
  websiteUrl: string
  // Both are permanent public Storage URLs (admin-uploaded via
  // /api/admin/upload, served through getPublicUrl — NOT the short-lived
  // signed URLs /api/download issues for the actual PDF). Safe to embed
  // directly; null when the admin hasn't set one, in which case the
  // template falls back to a text/gradient placeholder rather than a
  // hardcoded image.
  logoUrl?: string | null
  bookCoverUrl?: string | null
  // Guest checkout leaves this blank (the name field on /checkout is
  // optional) — the greeting line is only rendered when present.
  customerName?: string | null
}

export interface SendEmailResult {
  ok: boolean
  reason?: 'not_configured' | 'send_failed'
}

// Escapes the handful of fields that originate from customer-supplied
// checkout input (name, email) before they're interpolated into email HTML.
// checkout's EMAIL_RE (/^[^\s@]+@[^\s@]+\.[^\s@]+$/) permits characters like
// `<`/`>`/`"` in the local part, and the name field has no character
// restriction at all — so an unescaped value here is a real HTML-injection
// vector into whichever inbox renders it (the customer's own confirmation
// email, or the store owner's admin notification). Everything else
// interpolated into these templates (store name, product name, support
// email, logo/cover URLs) comes from admin-controlled store_settings, a
// trust boundary this project already treats as authoritative elsewhere
// (e.g. admin-set marketing copy is rendered as-is on the public site too).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatAmount(amount: number, currency: string, language: EmailLanguage): string {
  const symbol = currency === 'KWD' ? (language === 'ar' ? 'د.ك' : 'KWD') : currency
  return `${amount.toFixed(3)} ${symbol}`
}

// Split out for the customer-facing order summary card, which lists amount
// and currency as two separate rows rather than one combined "5.000 KWD"
// value (see buildEmailHtml). formatAmount above stays as-is since the
// admin notification email still wants them combined.
function formatCurrencyLabel(currency: string, language: EmailLanguage): string {
  return currency === 'KWD' ? (language === 'ar' ? 'د.ك' : 'KWD') : currency
}

function formatDate(iso: string, language: EmailLanguage): string {
  try {
    const locale = language === 'ar' ? 'ar-KW' : 'en-US'
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

// Full per-language copy — not a translation lookup over shared English
// strings, so each language's email reads naturally (word order, tone,
// punctuation) rather than like a mechanically-substituted template.
const COPY: Record<EmailLanguage, {
  dir: 'rtl' | 'ltr'
  subject: (invoiceNumber: string) => string
  preheader: string
  eyebrow: string
  heading: string
  greeting: (customerName: string) => string
  intro: (productName: string) => string
  orderCardTitle: string
  labelOrderNumber: string
  labelProductName: string
  labelAmount: string
  labelCurrency: string
  labelOrderDate: string
  labelEmail: string
  downloadTitle: string
  downloadButton: string
  linkFallback: string
  supportHeading: string
  supportSubtext: string
  websiteLabel: string
  footerBrand: string
  footerNote: string
}> = {
  ar: {
    dir: 'rtl',
    subject: () => 'تم استلام طلبك بنجاح ✨',
    preheader: 'تم تأكيد دفعتك — كتابك جاهز للتحميل الآن.',
    eyebrow: 'إيصال الشراء',
    heading: 'تم الدفع بنجاح 🎉',
    greeting: customerName => `مرحباً ${customerName}،`,
    intro: productName => `شكرًا لشرائك ${productName}.`,
    orderCardTitle: 'ملخص الطلب',
    labelOrderNumber: 'رقم الطلب',
    labelProductName: 'اسم المنتج',
    labelAmount: 'المبلغ',
    labelCurrency: 'العملة',
    labelOrderDate: 'تاريخ الطلب',
    labelEmail: 'البريد الإلكتروني',
    downloadTitle: 'كتابك جاهز',
    downloadButton: 'تحميل الكتاب',
    linkFallback: 'إذا لم يعمل الزر، انسخي هذا الرابط:',
    supportHeading: 'تحتاج مساعدة؟',
    supportSubtext: 'فريقنا هنا لمساعدتك في أي وقت',
    websiteLabel: 'زيارة موقع رَوْنَق',
    footerBrand: 'رَوْنَق | RWNK',
    footerNote: 'هذه رسالة إيصال آلية، لا حاجة للرد عليها',
  },
  en: {
    dir: 'ltr',
    subject: () => 'Your RWNK Guide is Ready ✨',
    preheader: 'Your payment is confirmed — your book is ready to download now.',
    eyebrow: 'Purchase Receipt',
    heading: 'Payment Successful 🎉',
    greeting: customerName => `Hi ${customerName},`,
    intro: productName => `Thank you for purchasing ${productName}.`,
    orderCardTitle: 'Order Summary',
    labelOrderNumber: 'Order Number',
    labelProductName: 'Product Name',
    labelAmount: 'Amount',
    labelCurrency: 'Currency',
    labelOrderDate: 'Order Date',
    labelEmail: 'Email',
    downloadTitle: 'Your book is ready',
    downloadButton: 'Download Your Book',
    linkFallback: "If the button doesn't work, copy this link:",
    supportHeading: 'Need help?',
    supportSubtext: "We're here to help anytime",
    websiteLabel: 'Visit the RWNK website',
    footerBrand: 'RWNK | رَوْنَق',
    footerNote: 'This is an automated receipt — no reply needed',
  },
}

// Table-based layout with inline styles only — the two things that survive
// every major email client's HTML sanitizer (Gmail/Outlook strip <style>
// blocks and mostly ignore flexbox/grid). Single-column, generous tap
// targets, max-width 100% images, bgcolor attributes alongside CSS
// background (Outlook's Word rendering engine honors the HTML attribute
// even when it drops the matching CSS) — this is "works in Gmail/Apple
// Mail/Outlook/mobile" for email specifically because it does NOT rely on
// @media queries or background-images most clients don't honor, not
// because it uses any responsive framework. Layout is identical between
// languages; only `dir`, text alignment for the value column, and the copy
// itself flip with C.dir.
function buildEmailHtml(p: PurchaseEmailParams): string {
  const C = COPY[p.language]
  const date = formatDate(p.purchaseDate, p.language)
  const currency = formatCurrencyLabel(p.currency, p.language)
  const valueAlign = C.dir === 'rtl' ? 'left' : 'right'
  const rows: [string, string, boolean?][] = [
    [C.labelOrderNumber, p.invoiceNumber, true],
    [C.labelProductName, escapeHtml(p.productName)],
    [C.labelAmount, p.amount.toFixed(3), true],
    [C.labelCurrency, currency, true],
    [C.labelOrderDate, date],
    [C.labelEmail, escapeHtml(p.to), true],
  ]

  return `<!doctype html>
<html lang="${p.language}" dir="${C.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(p.storeName)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F2FA;font-family:Tahoma,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(C.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2FA;" bgcolor="#F4F2FA">
    <tr><td style="padding:40px 16px;" align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #EDE8F5;box-shadow:0 4px 24px rgba(103,71,178,.06);" bgcolor="#FFFFFF">

        <!-- Accent bar -->
        <tr><td style="background:#6747B2;height:5px;line-height:5px;font-size:0;" bgcolor="#6747B2">&nbsp;</td></tr>

        <!-- Header -->
        <tr><td style="padding:30px 36px 24px;text-align:center;border-bottom:1px solid #F1EEFA;">
          ${p.logoUrl
            ? `<img src="${p.logoUrl}" alt="${escapeHtml(p.storeName)}" style="max-width:150px;max-height:44px;width:auto;height:auto;display:inline-block;border:0;" />`
            : `<div style="font-size:19px;font-weight:900;color:#6747B2;letter-spacing:.3px;">${escapeHtml(p.storeName)}</div>`}
        </td></tr>

        <!-- Success -->
        <tr><td style="padding:40px 36px 8px;text-align:center;">
          <div style="width:60px;height:60px;border-radius:50%;background:#E1F5EE;margin:0 auto 20px;line-height:60px;font-size:28px;" bgcolor="#E1F5EE">✅</div>
          <div style="font-size:11px;font-weight:900;color:#6747B2;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">${C.eyebrow}</div>
          <div style="font-size:23px;font-weight:900;color:#1A1228;margin-bottom:14px;">${C.heading}</div>
          ${p.customerName ? `<div style="font-size:14px;font-weight:700;color:#1A1228;margin-bottom:8px;">${C.greeting(escapeHtml(p.customerName))}</div>` : ''}
          <div style="font-size:14px;color:#4A4060;line-height:1.8;max-width:380px;margin:0 auto 28px;">
            ${C.intro(escapeHtml(p.productName))}
          </div>
        </td></tr>

        <!-- Book cover -->
        <tr><td style="padding:0 36px 32px;text-align:center;">
          ${p.bookCoverUrl
            ? `<img src="${p.bookCoverUrl}" alt="${escapeHtml(p.productName)}" width="104" style="width:104px;height:auto;border-radius:14px;box-shadow:0 10px 28px rgba(103,71,178,.28);display:inline-block;border:0;" />`
            : `<div style="width:104px;height:136px;border-radius:14px;display:inline-block;background:linear-gradient(145deg,#6747B2,#8b6dd4);box-shadow:0 10px 28px rgba(103,71,178,.28);"></div>`}
        </td></tr>

        <!-- Order summary card -->
        <tr><td style="padding:0 36px;">
          <div style="font-size:12px;font-weight:900;color:#1A1228;margin-bottom:10px;">${C.orderCardTitle}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5FE;border:1px solid #EDE8FF;border-radius:14px;" bgcolor="#F7F5FE">
            ${rows.map(([label, value, ltrValue], i) => {
              const border = i === 0 ? '' : 'border-top:1px solid #E4DEF7;'
              return `
            <tr><td style="padding:13px 20px;font-size:12.5px;color:#4A4060;${border}">${label}</td>
                <td style="padding:13px 20px;font-size:13px;font-weight:${ltrValue ? '900' : '700'};color:${ltrValue ? '#6747B2' : '#1A1228'};text-align:${valueAlign};${border}" dir="ltr">${value}</td></tr>`
            }).join('')}
          </table>
        </td></tr>

        <!-- Download CTA -->
        <tr><td style="padding:32px 36px;text-align:center;">
          <div style="font-size:14px;font-weight:900;color:#1A1228;margin-bottom:16px;">${C.downloadTitle}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td style="border-radius:13px;" bgcolor="#6747B2">
              <a href="${p.successUrl}" style="display:inline-block;background:#6747B2;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:900;padding:17px 48px;border-radius:13px;box-shadow:0 6px 20px rgba(103,71,178,.32);">
                ${C.downloadButton}
              </a>
            </td></tr>
          </table>
          <div style="font-size:11px;color:#9890AA;margin-top:16px;line-height:1.6;">
            ${C.linkFallback}<br>
            <a href="${p.successUrl}" style="color:#6747B2;word-break:break-all;">${p.successUrl}</a>
          </div>
        </td></tr>

        <!-- Support -->
        <tr><td style="padding:0 36px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;border:1px solid #F1EEFA;border-radius:14px;" bgcolor="#FAFAFA">
            <tr><td style="padding:22px 24px;text-align:center;">
              <div style="font-size:13px;font-weight:900;color:#1A1228;margin-bottom:4px;">${C.supportHeading}</div>
              <div style="font-size:12px;color:#9890AA;margin-bottom:12px;">${C.supportSubtext}</div>
              <a href="mailto:${p.supportEmail}" style="display:inline-block;color:#6747B2;font-weight:900;font-size:13px;text-decoration:none;direction:ltr;">${p.supportEmail}</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#FAFAFA;padding:24px 28px;text-align:center;border-top:1px solid #F1EEFA;" bgcolor="#FAFAFA">
          <div style="font-size:12px;font-weight:900;color:#4A4060;margin-bottom:6px;">${C.footerBrand}</div>
          <div style="font-size:10.5px;color:#C8C0D8;line-height:1.6;">© ${new Date(p.purchaseDate).getFullYear()} ${escapeHtml(p.storeName)} — ${C.footerNote}</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Shared Resend HTTP call for both email functions below. Retries once on a
// transient failure (network exception, or a 5xx — Resend's own infra
// having a bad moment) after a short delay; does NOT retry on a 4xx, since
// that means the request itself is wrong (bad API key, malformed payload,
// unverified sender domain) and an identical retry would just fail the same
// way. Never throws — every caller gets a result object back, and every
// failure is logged with enough detail (status + body, or the exception
// message) to diagnose from server logs alone. This is what "emails must
// never silently fail" means in practice: not that sending can't fail, but
// that a failure is always visible and never mistaken for success.
async function sendResendEmail(logLabel: string, apiKey: string, from: string, to: string, subject: string, html: string): Promise<SendEmailResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to: [to], subject, html }),
      })
      const bodyText = await res.text()
      if (res.ok) {
        console.log(`[email] ${logLabel} sent to ${to}${attempt > 1 ? ` (succeeded on retry ${attempt})` : ''}`)
        return { ok: true }
      }
      const retryable = res.status >= 500
      console.error(`[email] ${logLabel} to ${to} failed — HTTP ${res.status}: ${bodyText.slice(0, 500)}${retryable && attempt === 1 ? ' — retrying once' : ''}`)
      if (!retryable || attempt === 2) return { ok: false, reason: 'send_failed' }
    } catch (err: any) {
      console.error(`[email] ${logLabel} to ${to} threw: ${err?.message ?? err}${attempt === 1 ? ' — retrying once' : ''}`)
      if (attempt === 2) return { ok: false, reason: 'send_failed' }
    }
    await new Promise(resolve => setTimeout(resolve, 800))
  }
  return { ok: false, reason: 'send_failed' }
}

export interface AdminOrderNotificationParams {
  to: string
  storeName: string
  customerName: string | null
  customerEmail: string
  amount: number
  currency: string
  language: EmailLanguage
  invoiceNumber: string
  purchaseDate: string // ISO string
}

// Plain-text, not the branded HTML template — this goes to the store owner's
// inbox as an operational notice, not a customer-facing receipt, so it's
// optimized for being scanned in a notifications list rather than for brand
// presentation. Same never-throws contract as sendPurchaseConfirmationEmail:
// this fires from the same best-effort post-payment hook and must never be
// allowed to affect an already-completed purchase.
export async function sendAdminOrderNotification(p: AdminOrderNotificationParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.warn(`[email] admin order notification NOT sent — RESEND_API_KEY/EMAIL_FROM not configured.`)
    return { ok: false, reason: 'not_configured' }
  }

  const date = formatDate(p.purchaseDate, 'ar')
  const languageLabel = p.language === 'en' ? 'English 🇺🇸' : 'العربية 🇸🇦'
  const amount = formatAmount(p.amount, p.currency, 'ar')

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#FAFAFA;font-family:Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE8F5;">
    <tr><td style="background:#1A1228;padding:18px 24px;">
      <div style="font-size:16px;font-weight:900;color:#fff;">🔔 طلب جديد — ${p.storeName}</div>
    </td></tr>
    <tr><td style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['العميل', p.customerName ? escapeHtml(p.customerName) : '—'],
          ['البريد الإلكتروني', escapeHtml(p.customerEmail)],
          ['المبلغ', amount],
          ['اللغة المختارة', languageLabel],
          ['رقم الفاتورة', p.invoiceNumber],
          ['تاريخ الشراء', date],
        ].map(([label, value]) => `
        <tr><td style="padding:8px 0;font-size:13px;color:#9890AA;">${label}</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:#1A1228;text-align:left;" dir="ltr">${value}</td></tr>`).join('')}
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return sendResendEmail('admin order notification', apiKey, from, p.to, `🔔 طلب جديد — ${amount} — ${p.customerEmail}`, html)
}

// Never throws. Returns {ok:false, reason:'not_configured'} if RESEND_API_KEY
// or EMAIL_FROM aren't set (logged once, treated as a normal — not
// exceptional — deployment state, since email is explicitly optional per
// the "never fail the purchase" requirement) and {ok:false,
// reason:'send_failed'} for any network/API-level failure (after one retry
// on transient errors — see sendResendEmail), with the actual error detail
// always logged server-side either way.
export async function sendPurchaseConfirmationEmail(p: PurchaseEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.warn(`[email] purchase confirmation NOT sent to ${p.to} — RESEND_API_KEY/EMAIL_FROM not configured. This is non-fatal: the Success page remains the guaranteed delivery path.`)
    return { ok: false, reason: 'not_configured' }
  }

  const subject = COPY[p.language].subject(p.invoiceNumber)
  return sendResendEmail(`purchase confirmation (language=${p.language}, invoice=${p.invoiceNumber})`, apiKey, from, p.to, subject, buildEmailHtml(p))
}

export interface TestEmailResult extends SendEmailResult {
  configured: boolean
}

// Diagnostic-only send used by the admin-gated /api/admin/email-test route
// (POST, manual trigger only — never called from build, page render, or app
// startup). Deliberately reuses sendResendEmail rather than a separate
// fetch call, so a real send exercises the exact same code path production
// email goes through. Recipient is always the calling admin's own account
// email (enforced by the route, not here) — this endpoint must never become
// a "send to arbitrary address" primitive.
export async function sendTestEmail(to: string): Promise<TestEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return { ok: false, configured: false, reason: 'not_configured' }
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="font-family:Tahoma,Arial,sans-serif;padding:24px;background:#FAFAFA;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border:1px solid #EDE8F5;border-radius:12px;padding:24px;">
    <div style="font-size:15px;font-weight:900;color:#1A1228;margin-bottom:8px;">✅ RWNK / Resend test email</div>
    <div style="font-size:13px;color:#4A4060;line-height:1.6;">
      This is a diagnostic email sent from the admin dashboard's Resend test endpoint. If you received this, RESEND_API_KEY and EMAIL_FROM are both configured correctly and Resend accepted the send. Safe to ignore.
    </div>
    <div style="font-size:11px;color:#9890AA;margin-top:16px;">Sent ${new Date().toISOString()}</div>
  </div>
</body></html>`

  const result = await sendResendEmail('admin diagnostic test email', apiKey, from, to, 'RWNK — Resend test email', html)
  return { ...result, configured: true }
}
