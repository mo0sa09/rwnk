import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { isMissingTableError, missingTableMessage, getSingletonRow } from '@/lib/db-resilience'
import { sendAdminInvitationEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVITABLE_ROLES = new Set(['admin', 'staff'])
const EXPIRES_IN_MS = 48 * 60 * 60 * 1000 // 48 hours

// Only the super-admin can invite — an 'admin' being able to invite more
// admins (or staff) would let them hand out access the owner never agreed
// to. Mirrors the spec exactly: "Admin Cannot: Invite/remove other admins."
export async function POST(request: NextRequest) {
  const { user, error: authErr } = await requireAdmin(request, ['super_admin'])
  if (authErr) return authErr

  // Keyed by the inviting super-admin's own id — this endpoint is already
  // behind requireAdmin, so this is just hygiene against a compromised
  // session or a buggy client retry loop, not the primary defense.
  if (!rateLimit(`invite:${user!.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'عدد كبير من الدعوات في وقت قصير، حاولي لاحقاً' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : null
  const role = INVITABLE_ROLES.has(body?.role) ? body.role : null

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
  }
  if (!role) {
    return NextResponse.json({ error: 'الصلاحية يجب أن تكون admin أو staff' }, { status: 400 })
  }

  const sb = getAdminDb()

  // Prevent inviting an email that's already an active admin_users row —
  // nothing to accept, they already have access.
  const { data: existingAdmin, error: existingErr } = await sb.from('admin_users').select('id,is_active').ilike('email', email).maybeSingle()
  if (existingErr && isMissingTableError(existingErr)) {
    return NextResponse.json({ error: missingTableMessage('admin_users'), migrationRequired: true }, { status: 503 })
  }
  if (existingAdmin?.is_active) {
    return NextResponse.json({ error: 'هذا البريد لديه صلاحية مشرف فعّالة مسبقاً' }, { status: 409 })
  }

  // Prevent duplicate ACTIVE invitations (not accepted, not revoked, not yet
  // expired) — an expired one is simply superseded by a fresh invite below.
  const { data: pending } = await sb.from('admin_invitations')
    .select('id').eq('email', email)
    .is('accepted_at', null).is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (pending) {
    return NextResponse.json({ error: 'توجد دعوة سارية لهذا البريد مسبقاً — يمكنك إعادة إرسالها من القائمة' }, { status: 409 })
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + EXPIRES_IN_MS).toISOString()

  const { data: invitation, error: insertErr } = await sb.from('admin_invitations').insert({
    email, name, role, token_hash: tokenHash, expires_at: expiresAt, invited_by: user!.id,
  }).select('id').single()

  if (insertErr) {
    if (isMissingTableError(insertErr)) {
      return NextResponse.json({ error: missingTableMessage('admin_invitations'), migrationRequired: true }, { status: 503 })
    }
    console.error(`[admin/staff/invite] failed to create invitation for ${email}: ${insertErr.message}`)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const acceptUrl = `${appUrl}/admin/invite/${rawToken}`

  const { data: settings } = await getSingletonRow<{ store_name: string; logo_url: string | null }>(sb, 'store_settings', 'store_name,logo_url')
  const emailResult = await sendAdminInvitationEmail({
    to: email, name, role, storeName: settings?.store_name ?? 'رَوْنَق', acceptUrl, logoUrl: settings?.logo_url ?? null,
  })
  if (!emailResult.ok) {
    console.warn(`[admin/staff/invite] invitation ${invitation.id} created but email not sent (${emailResult.reason}) — admin can resend from the staff list`)
  }

  console.log(`[admin/staff/invite] invited ${email} as ${role} (invitation=${invitation.id}, by=${user!.id}, emailSent=${emailResult.ok})`)
  return NextResponse.json({ ok: true, emailSent: emailResult.ok })
}
