import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { getSingletonRow } from '@/lib/db-resilience'
import { sendAdminInvitationEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

const EXPIRES_IN_MS = 48 * 60 * 60 * 1000

// Rotates the token (never re-sends the OLD one — a previously-leaked/
// forwarded copy of the old link must stop working) and resets the 48h
// expiry on the SAME invitation row, rather than creating a new one — one
// row per invited email, rather than accumulating duplicates every time an
// admin clicks resend.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authErr } = await requireAdmin(request, ['super_admin'])
  if (authErr) return authErr

  if (!rateLimit(`invite-resend:${user!.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'عدد كبير من المحاولات، حاولي لاحقاً' }, { status: 429 })
  }

  const sb = getAdminDb()
  const { data: invitation, error: findErr } = await sb.from('admin_invitations')
    .select('id,email,name,role')
    .eq('id', id).is('accepted_at', null).is('revoked_at', null)
    .maybeSingle()

  if (findErr || !invitation) {
    return NextResponse.json({ error: 'الدعوة غير موجودة أو تم قبولها/إلغاؤها مسبقاً' }, { status: 404 })
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + EXPIRES_IN_MS).toISOString()

  const { error: updateErr } = await sb.from('admin_invitations')
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq('id', id)
  if (updateErr) {
    console.error(`[admin/staff/invitations/${id}/resend] failed to rotate token: ${updateErr.message}`)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const acceptUrl = `${appUrl}/admin/invite/${rawToken}`
  const { data: settings } = await getSingletonRow<{ store_name: string; logo_url: string | null }>(sb, 'store_settings', 'store_name,logo_url')

  const emailResult = await sendAdminInvitationEmail({
    to: invitation.email, name: invitation.name, role: invitation.role,
    storeName: settings?.store_name ?? 'رَوْنَق', acceptUrl, logoUrl: settings?.logo_url ?? null,
  })

  console.log(`[admin/staff/invitations/${id}/resend] resent to ${invitation.email} by ${user!.id} (emailSent=${emailResult.ok})`)
  return NextResponse.json({ ok: true, emailSent: emailResult.ok })
}
