import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

// Lets a customer set their password right after a purchase, from the
// Success page's "أنشئي كلمة مرور" form — WITHOUT going through
// supabase.auth.signUp(), which always fails here. By the time the Success
// page is reachable, ensureUserLinked() (src/lib/payment-access.ts, run
// synchronously from /api/payment/callback right after the purchase
// completed) has ALREADY created this email's Supabase Auth account —
// passwordless, purely so the purchase has somewhere to link to. signUp()
// therefore always hits "already registered" for a brand new customer too,
// which used to silently discard the password they just typed and shove
// them into an email-reset round trip instead — confusing, and (until the
// /reset-password page existed) a dead end.
//
// This route uses the app_metadata.password_set flag ensureUserLinked now
// stamps on creation (app_metadata, not user_metadata, so a signed-in
// customer can never flip it themselves via updateUser()) to tell the two
// real cases apart:
//   - password_set is false/missing → phantom account, nobody has ever
//     actually set a password on it. Safe to set the one the customer just
//     typed directly via admin.updateUserById. This is the common case for
//     every first-time "save my access" click.
//   - password_set is true → a real password already exists (this customer
//     set one on a previous purchase, or registered independently via
//     /register). NEVER overwritten here — the caller falls back to
//     resetPasswordForEmail instead, so the customer proves they own the
//     inbox before any credential changes.
//
// Ownership is the same purchaseId+email trust model already used by
// /api/download/token and /api/purchase-status: purchaseId is an
// unguessable UUID never exposed publicly, and the email must match what's
// actually on that completed purchase row.
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const purchaseId = typeof body?.purchaseId === 'string' ? body.purchaseId : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!purchaseId || !email) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 })

  const { url: sbUrl, key: sbKey } = getSupabaseServerEnv()
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  const { data: purchase, error: purchaseErr } = await sb.from('purchases')
    .select('id,user_id,email,guest_email,status')
    .eq('id', purchaseId).single()

  const targetEmail = email.toLowerCase()
  const purchaseEmail = purchase?.email?.toLowerCase()
  const guestEmail = purchase?.guest_email?.toLowerCase()
  if (purchaseErr || !purchase || (purchaseEmail !== targetEmail && guestEmail !== targetEmail)) {
    console.error(`[account/set-password] purchase ${purchaseId} not found or email mismatch (got ${targetEmail}): ${purchaseErr?.message ?? 'no match'}`)
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }
  if (purchase.status !== 'completed') {
    console.warn(`[account/set-password] purchase ${purchaseId} is not completed (status=${purchase.status}) — refusing`)
    return NextResponse.json({ error: 'لم تكتمل عملية الدفع لهذا الطلب' }, { status: 403 })
  }

  // Normally already set by ensureUserLinked at payment-completion time —
  // this fallback lookup only matters if that write raced/failed and hasn't
  // caught up yet.
  let userId: string | null = purchase.user_id ?? null
  if (!userId) {
    console.warn(`[account/set-password] purchase ${purchaseId} has no user_id yet — looking up ${targetEmail} directly`)
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) break
      const found = data.users.find((u: any) => u.email?.toLowerCase() === targetEmail)
      if (found) userId = found.id
      if (data.users.length < 1000) break
    }
  }
  if (!userId) {
    console.error(`[account/set-password] purchase ${purchaseId} — no auth account found for ${targetEmail}`)
    return NextResponse.json({ error: 'تعذّر العثور على الحساب' }, { status: 404 })
  }

  const { data: userRes, error: getErr } = await sb.auth.admin.getUserById(userId)
  if (getErr || !userRes?.user) {
    console.error(`[account/set-password] purchase ${purchaseId} — getUserById(${userId}) failed: ${getErr?.message ?? 'no user'}`)
    return NextResponse.json({ error: 'تعذّر العثور على الحساب' }, { status: 404 })
  }

  if (userRes.user.app_metadata?.password_set === true) {
    console.log(`[account/set-password] purchase ${purchaseId} — ${targetEmail} already has a real password, not overwriting; caller should send a reset link instead`)
    return NextResponse.json({ alreadyExists: true })
  }

  const { error: updateErr } = await sb.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { ...(userRes.user.app_metadata ?? {}), password_set: true },
  })
  if (updateErr) {
    console.error(`[account/set-password] purchase ${purchaseId} — updateUserById(${userId}) failed: ${updateErr.message}`)
    return NextResponse.json({ error: 'تعذّر حفظ كلمة المرور' }, { status: 500 })
  }

  // Idempotent — ensureUserLinked already did this at payment-completion
  // time for the common case; only actually writes anything on the
  // fallback-lookup path above.
  const { error: linkErr } = await sb.from('purchases')
    .update({ user_id: userId, account_created: true })
    .eq('id', purchaseId)
  if (linkErr) console.error(`[account/set-password] purchase ${purchaseId} — failed to confirm user_id link: ${linkErr.message}`)

  console.log(`[account/set-password] purchase ${purchaseId} — password set for ${targetEmail} (user ${userId})`)
  return NextResponse.json({ ok: true, alreadyExists: false })
}
