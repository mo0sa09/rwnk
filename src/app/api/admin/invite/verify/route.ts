import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseServerEnv } from '@/lib/env'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Public (no requireAdmin) — this is the one route an invitee with no
// account yet can call. Authorization IS the token itself: possessing the
// raw 256-bit value (only ever delivered via the invitation email) is what
// proves the caller is the invited person, the same trust model
// /api/download already uses for download tokens.
//
// Every failure (not found / expired / already accepted / revoked) returns
// the SAME generic message — §9 of the spec: "do not leak whether an
// arbitrary email exists in the system through public endpoints." A
// distinguishable "this token doesn't exist" vs "this token is used up"
// response would let someone probe for valid-looking tokens; a single
// outcome gives nothing away beyond "this link doesn't work."
const GENERIC_ERROR = 'رابط الدعوة غير صالح أو منتهي الصلاحية'

export async function GET(request: NextRequest) {
  if (!rateLimit(`invite-verify:${clientIp(request)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 429 })
  }

  const token = request.nextUrl.searchParams.get('token') ?? ''
  if (!token) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })

  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { data: invitation } = await sb.from('admin_invitations')
    .select('email,name,role,expires_at,accepted_at,revoked_at')
    .eq('token_hash', tokenHash).maybeSingle()

  if (!invitation || invitation.accepted_at || invitation.revoked_at || new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 404 })
  }

  return NextResponse.json({ data: { email: invitation.email, name: invitation.name, role: invitation.role } })
}
