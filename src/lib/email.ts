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

export interface PurchaseEmailParams {
  to: string
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

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === 'KWD' ? 'د.ك' : currency
  return `${amount.toFixed(3)} ${symbol}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

// Table-based layout with inline styles only — the two things that survive
// every major email client's HTML sanitizer (Gmail/Outlook strip <style>
// blocks and mostly ignore flexbox/grid). Single-column, generous tap
// targets, max-width 100% images — this is "mobile-friendly" for email
// specifically because it does NOT rely on @media queries most clients
// don't honor, not because it uses any responsive framework.
function buildEmailHtml(p: PurchaseEmailParams): string {
  const amount = formatAmount(p.amount, p.currency)
  const date = formatDate(p.purchaseDate)
  return `<!doctype html>
<html lang="ar" dir="rtl">
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
          <div style="font-size:20px;font-weight:900;color:#1A1228;margin-bottom:8px;">تم الدفع بنجاح</div>
          <div style="font-size:14px;color:#4A4060;line-height:1.7;margin-bottom:24px;">
            شكراً لشرائك — ${p.productName} الآن ملكك ويمكنك تحميله فوراً.
          </div>
        </td></tr>

        <tr><td style="padding:0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE8FF;border-radius:12px;padding:4px;">
            <tr><td style="padding:14px 18px;font-size:13px;color:#4A4060;">رقم الطلب</td>
                <td style="padding:14px 18px;font-size:13px;font-weight:900;color:#1A1228;text-align:left;" dir="ltr">${p.invoiceNumber}</td></tr>
            <tr><td style="padding:0 18px 14px;font-size:13px;color:#4A4060;border-top:1px solid #DDD6F0;padding-top:14px;">تاريخ الشراء</td>
                <td style="padding:0 18px 14px;font-size:13px;font-weight:700;color:#1A1228;text-align:left;border-top:1px solid #DDD6F0;padding-top:14px;">${date}</td></tr>
            <tr><td style="padding:0 18px 14px;font-size:13px;color:#4A4060;border-top:1px solid #DDD6F0;padding-top:14px;">المبلغ المدفوع</td>
                <td style="padding:0 18px 14px;font-size:14px;font-weight:900;color:#6747B2;text-align:left;border-top:1px solid #DDD6F0;padding-top:14px;" dir="ltr">${amount}</td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:28px;text-align:center;">
          <a href="${p.successUrl}" style="display:inline-block;background:#6747B2;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:900;padding:16px 40px;border-radius:12px;">
            تحميل الكتاب الآن
          </a>
          <div style="font-size:11px;color:#9890AA;margin-top:12px;line-height:1.6;">
            إذا لم يعمل الزر، انسخي هذا الرابط:<br>
            <a href="${p.successUrl}" style="color:#6747B2;word-break:break-all;">${p.successUrl}</a>
          </div>
        </td></tr>

        <tr><td style="padding:0 28px 28px;">
          <div style="height:1px;background:#EDE8F5;margin-bottom:20px;"></div>
          <div style="font-size:12px;color:#9890AA;text-align:center;line-height:1.8;">
            تحتاجين مساعدة؟ تواصلي معنا على<br>
            <a href="mailto:${p.supportEmail}" style="color:#6747B2;font-weight:700;text-decoration:none;">${p.supportEmail}</a>
          </div>
        </td></tr>

        <tr><td style="background:#FAFAFA;padding:16px;text-align:center;">
          <div style="font-size:10px;color:#C8C0D8;">© ${new Date(p.purchaseDate).getFullYear()} ${p.storeName} — هذه رسالة إيصال آلية</div>
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

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [p.to],
        subject: `تم الدفع بنجاح — ${p.invoiceNumber}`,
        html: buildEmailHtml(p),
      }),
    })
    const bodyText = await res.text()
    if (!res.ok) {
      console.error(`[email] purchase confirmation to ${p.to} failed — HTTP ${res.status}: ${bodyText.slice(0, 500)}`)
      return { ok: false, reason: 'send_failed' }
    }
    console.log(`[email] purchase confirmation sent to ${p.to} for invoice ${p.invoiceNumber}`)
    return { ok: true }
  } catch (err: any) {
    console.error(`[email] purchase confirmation to ${p.to} threw: ${err?.message ?? err}`)
    return { ok: false, reason: 'send_failed' }
  }
}
