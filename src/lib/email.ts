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
}

export interface SendEmailResult {
  ok: boolean
  reason?: 'not_configured' | 'send_failed'
}

function formatAmount(amount: number, currency: string, language: EmailLanguage): string {
  const symbol = currency === 'KWD' ? (language === 'ar' ? 'د.ك' : 'KWD') : currency
  return `${amount.toFixed(3)} ${symbol}`
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
  heading: string
  intro: (productName: string) => string
  labelOrderNumber: string
  labelBookName: string
  labelLanguage: string
  labelPurchaseDate: string
  labelAmountPaid: string
  languageValue: string
  downloadButton: string
  linkFallback: string
  supportIntro: string
  footerNote: string
}> = {
  ar: {
    dir: 'rtl',
    subject: () => 'تم استلام طلبك بنجاح ✨',
    heading: 'تم الدفع بنجاح!',
    intro: productName => `شكراً لشرائك — ${productName} الآن ملكك ويمكنك تحميله فوراً.`,
    labelOrderNumber: 'رقم الطلب',
    labelBookName: 'اسم الكتاب',
    labelLanguage: 'اللغة المختارة',
    labelPurchaseDate: 'تاريخ الشراء',
    labelAmountPaid: 'المبلغ المدفوع',
    languageValue: '🇸🇦 العربية',
    downloadButton: 'تحميل الكتاب الآن',
    linkFallback: 'إذا لم يعمل الزر، انسخي هذا الرابط:',
    supportIntro: 'تحتاجين مساعدة؟ تواصلي معنا على',
    footerNote: 'هذه رسالة إيصال آلية',
  },
  en: {
    dir: 'ltr',
    subject: () => 'Your RWNK Guide is Ready ✨',
    heading: 'Payment Successful!',
    intro: productName => `Thank you for your purchase — ${productName} is now yours and ready to download.`,
    labelOrderNumber: 'Order Number',
    labelBookName: 'Book',
    labelLanguage: 'Selected Language',
    labelPurchaseDate: 'Purchase Date',
    labelAmountPaid: 'Amount Paid',
    languageValue: '🇺🇸 English',
    downloadButton: 'Download Your Book Now',
    linkFallback: "If the button doesn't work, copy this link:",
    supportIntro: 'Need help? Contact us at',
    footerNote: 'This is an automated receipt',
  },
}

// Table-based layout with inline styles only — the two things that survive
// every major email client's HTML sanitizer (Gmail/Outlook strip <style>
// blocks and mostly ignore flexbox/grid). Single-column, generous tap
// targets, max-width 100% images — this is "mobile-friendly" for email
// specifically because it does NOT rely on @media queries most clients
// don't honor, not because it uses any responsive framework. Layout is
// identical between languages; only `dir`, text alignment for the
// value column, and the copy itself flip with C.dir.
function buildEmailHtml(p: PurchaseEmailParams): string {
  const C = COPY[p.language]
  const amount = formatAmount(p.amount, p.currency, p.language)
  const date = formatDate(p.purchaseDate, p.language)
  const valueAlign = C.dir === 'rtl' ? 'left' : 'right'
  const rows: [string, string, boolean?][] = [
    [C.labelOrderNumber, p.invoiceNumber, true],
    [C.labelBookName, p.productName],
    [C.labelLanguage, C.languageValue],
    [C.labelPurchaseDate, date],
    [C.labelAmountPaid, amount, true],
  ]

  return `<!doctype html>
<html lang="${p.language}" dir="${C.dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${p.storeName}</title></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #EDE8F5;">

        <tr><td style="background:#6747B2;padding:28px 24px;text-align:center;">
          <div style="font-size:20px;font-weight:900;color:#FFFFFF;">${p.storeName}</div>
        </tr></td>

        <tr><td style="padding:32px 28px 8px;text-align:center;">
          <div style="width:56px;height:56px;border-radius:50%;background:#E1F5EE;margin:0 auto 16px;line-height:56px;font-size:26px;">✅</div>
          <div style="font-size:20px;font-weight:900;color:#1A1228;margin-bottom:8px;">${C.heading}</div>
          <div style="font-size:14px;color:#4A4060;line-height:1.7;margin-bottom:24px;">
            ${C.intro(p.productName)}
          </div>
        </td></tr>

        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE8FF;border-radius:12px;padding:4px;">
            ${rows.map(([label, value, ltrValue], i) => {
              const isLast = i === rows.length - 1
              const border = i === 0 ? '' : 'border-top:1px solid #DDD6F0;'
              return `
            <tr><td style="padding:14px 18px;font-size:13px;color:#4A4060;${border}">${label}</td>
                <td style="padding:14px 18px;font-size:${isLast ? '14px' : '13px'};font-weight:${isLast ? '900' : '700'};color:${isLast ? '#6747B2' : '#1A1228'};text-align:${valueAlign};${border}"${ltrValue ? ' dir="ltr"' : ''}>${value}</td></tr>`
            }).join('')}
          </table>
        </td></tr>

        <tr><td style="padding:28px;text-align:center;">
          <a href="${p.successUrl}" style="display:inline-block;background:#6747B2;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:900;padding:16px 40px;border-radius:12px;">
            ${C.downloadButton}
          </a>
          <div style="font-size:11px;color:#9890AA;margin-top:12px;line-height:1.6;">
            ${C.linkFallback}<br>
            <a href="${p.successUrl}" style="color:#6747B2;word-break:break-all;">${p.successUrl}</a>
          </div>
        </td></tr>

        <tr><td style="padding:0 28px 28px;">
          <div style="height:1px;background:#EDE8F5;margin-bottom:20px;"></div>
          <div style="font-size:12px;color:#9890AA;text-align:center;line-height:1.8;">
            ${C.supportIntro}<br>
            <a href="mailto:${p.supportEmail}" style="color:#6747B2;font-weight:700;text-decoration:none;">${p.supportEmail}</a>
          </div>
        </td></tr>

        <tr><td style="background:#FAFAFA;padding:16px;text-align:center;">
          <div style="font-size:10px;color:#C8C0D8;">© ${new Date(p.purchaseDate).getFullYear()} ${p.storeName} — ${C.footerNote}</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Never throws. Returns {ok:false, reason:'not_configured'} if RESEND_API_KEY
// or EMAIL_FROM aren't set (logged once, treated as a normal — not
// exceptional — deployment state, since email is explicitly optional per
// the "never fail the purchase" requirement) and {ok:false,
// reason:'send_failed'} for any network/API-level failure, with the actual
// error detail always logged server-side either way.
export async function sendPurchaseConfirmationEmail(p: PurchaseEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.warn(`[email] purchase confirmation NOT sent to ${p.to} — RESEND_API_KEY/EMAIL_FROM not configured. This is non-fatal: the Success page remains the guaranteed delivery path.`)
    return { ok: false, reason: 'not_configured' }
  }

  const subject = COPY[p.language].subject(p.invoiceNumber)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [p.to],
        subject,
        html: buildEmailHtml(p),
      }),
    })
    const bodyText = await res.text()
    if (!res.ok) {
      console.error(`[email] purchase confirmation to ${p.to} (language=${p.language}) failed — HTTP ${res.status}: ${bodyText.slice(0, 500)}`)
      return { ok: false, reason: 'send_failed' }
    }
    console.log(`[email] purchase confirmation sent to ${p.to} (language=${p.language}) for invoice ${p.invoiceNumber}`)
    return { ok: true }
  } catch (err: any) {
    console.error(`[email] purchase confirmation to ${p.to} (language=${p.language}) threw: ${err?.message ?? err}`)
    return { ok: false, reason: 'send_failed' }
  }
}
