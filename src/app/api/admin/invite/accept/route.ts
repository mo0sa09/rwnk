import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseServerEnv } from '@/lib/env'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const GENERIC_ERROR = 'رابط الدعوة غير صالح أو منتهي الصلاحية'

// Public (no requireAdmin) — same token-as-authorization model as
// /api/admin/invite/verify. Does NOT use supabase.auth.signUp() or the
// customer /register flow (§4/§13 of the spec: "Do NOT use a normal
// customer registration flow", "Do not duplicate Supabase Auth users") —
// this creates/updates the Auth user directly via the admin API, exactly
// the same "try create, fall back to lookup-by-email on already-registered"
// pattern already proven in src/lib/payment-access.ts (ensureUserLinked)
// and /api/account/set-password, reused here rather than inventing a
// second way to provision an account.
export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  if (!rateLimit(`invite-accept:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 })

  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { data: invitation, error: findErr } = await sb.from('admin_invitations')
    .select('id,email,name,role,expires_at,accepted_at,revoked_at')
    .eq('token_hash', tokenHash).maybeSingle()

  if (findErr || !invitation || invitation.accepted_at || invitation.revoked_at || new Date(invitation.expires_at) < new Date()) {
    console.warn(`[admin/invite/accept] rejected token from ${ip} — not found, expired, already used, or revoked`)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 404 })
  }

  const email = invitation.email as string
  let userId: string | null = null
  let passwordApplied = false

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: invitation.name ? { full_name: invitation.name } : undefined,
    app_metadata: { password_set: true },
  })

  if (!createErr) {
    userId = created.user.id
    passwordApplied = true
  } else {
    const msg = (createErr.message ?? '').toLowerCase()
    const alreadyExists = msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered')
    if (!alreadyExists) {
      console.error(`[admin/invite/accept] createUser failed for ${email}: ${createErr.message}`)
      return NextResponse.json({ error: 'تعذّر إنشاء الحساب، حاولي مرة أخرى' }, { status: 500 })
    }

    // This email already has a Supabase Auth account — could be an existing
    // customer. Find it the same way ensureUserLinked/set-password do, then
    // decide whether it's safe to set the password directly (a phantom,
    // never-password-set account — e.g. created by a guest checkout) or
    // whether a real password already exists and must never be overwritten
    // here (see /api/account/set-password's own comment for the full
    // reasoning behind app_metadata.password_set).
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) break
      const found = data.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (found) userId = found.id
      if (data.users.length < 1000) break
    }
    if (!userId) {
      console.error(`[admin/invite/accept] createUser said "already registered" but no matching account was found for ${email}`)
      return NextResponse.json({ error: 'تعذّر إنشاء الحساب، حاولي مرة أخرى' }, { status: 500 })
    }

    const { data: userRes } = await sb.auth.admin.getUserById(userId)
    const alreadyHasPassword = userRes?.user?.app_metadata?.password_set === true

    if (!alreadyHasPassword) {
      const { error: updateErr } = await sb.auth.admin.updateUserById(userId, {
        password,
        app_metadata: { ...(userRes?.user?.app_metadata ?? {}), password_set: true },
      })
      if (updateErr) {
        console.error(`[admin/invite/accept] updateUserById(${userId}) failed: ${updateErr.message}`)
        return NextResponse.json({ error: 'تعذّر حفظ كلمة المرور' }, { status: 500 })
      }
      passwordApplied = true
    }
    // else: a real password already exists — never overwritten. The client
    // gets alreadyExists:true below and sends a reset-password email
    // instead, same UX as the returning-customer path on /success.
  }

  // Mark accepted via a compare-and-swap, same pattern purchases.status
  // uses for payment finalization — guards against the same token being
  // raced through two concurrent accept requests.
  const { data: settled, error: acceptErr } = await sb.from('admin_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id).is('accepted_at', null)
    .select('id').maybeSingle()
  if (acceptErr) {
    console.error(`[admin/invite/accept] failed to mark invitation ${invitation.id} accepted: ${acceptErr.message}`)
  }
  if (!settled) {
    // Another concurrent request already accepted this exact token first.
    console.warn(`[admin/invite/accept] invitation ${invitation.id} was already accepted by a concurrent request`)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 409 })
  }

  const { error: upsertErr } = await sb.from('admin_users').upsert({
    id: userId, email, full_name: invitation.name, role: invitation.role, is_active: true, invited_by: invitation.invited_by ?? null,
  }, { onConflict: 'id' })
  if (upsertErr) {
    console.error(`[admin/invite/accept] failed to grant admin_users role for ${email} (user ${userId}): ${upsertErr.message}`)
    return NextResponse.json({ error: 'تم قبول الدعوة لكن تعذّر منح الصلاحية، تواصلي مع المالك' }, { status: 500 })
  }

  console.log(`[admin/invite/accept] invitation ${invitation.id} accepted — ${email} (user ${userId}) granted role=${invitation.role}`)
  return NextResponse.json({ ok: true, email, alreadyExists: !passwordApplied })
}
