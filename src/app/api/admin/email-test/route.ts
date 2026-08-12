import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { sendTestEmail } from '@/lib/email'

// Manual diagnostic endpoint for verifying the Resend integration is
// actually working end-to-end (RESEND_API_KEY/EMAIL_FROM present, Resend
// reachable, a send succeeds) — never called automatically from build,
// page render, or app startup. Trigger it yourself:
//
//   curl -X POST https://<your-domain>/api/admin/email-test \
//     -H "Cookie: <your-logged-in-admin-session-cookie>"
//
// or simplest: while logged into /admin in the browser, run in devtools:
//   fetch('/api/admin/email-test', { method: 'POST' }).then(r => r.json()).then(console.log)
//
// Admin-gated (requireAdmin — same check every other /api/admin/* route
// uses) and always sends to the CALLING ADMIN'S OWN account email, never a
// client-supplied address — this endpoint must never become a way to send
// arbitrary email through the project's Resend account.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request)
  if (error) return error

  const to = user!.email
  if (!to) {
    // Practically unreachable (Supabase users are email-identified here),
    // but requireAdmin's type only guarantees `user`, not `user.email`.
    return NextResponse.json({ ok: false, reason: 'admin_has_no_email' }, { status: 400 })
  }

  const result = await sendTestEmail(to)

  if (!result.configured) {
    console.warn('[email-test] RESEND_API_KEY/EMAIL_FROM not configured — nothing sent')
    return NextResponse.json(
      { ok: false, reason: 'not_configured', message: 'RESEND_API_KEY and/or EMAIL_FROM are not set in this environment.' },
      { status: 200 }
    )
  }

  if (!result.ok) {
    // Full diagnostic detail (HTTP status, Resend's response body) is
    // already logged server-side inside sendResendEmail — never relayed to
    // the client, which only needs to know "it failed" plus a safe reason.
    console.error(`[email-test] send failed for admin ${to} — see server logs above for HTTP status/response body`)
    return NextResponse.json(
      { ok: false, reason: result.reason ?? 'send_failed', message: 'Resend rejected the send or was unreachable — check server logs for details.' },
      { status: 200 }
    )
  }

  console.log(`[email-test] test email sent successfully to admin ${to}`)
  return NextResponse.json({ ok: true, message: `Test email sent to ${to}. Check that inbox.` })
}
