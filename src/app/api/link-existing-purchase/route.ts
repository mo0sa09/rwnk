import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Handles the "existing customer buys again" case: createAccountAfterPurchase()
// tries auth.signUp() first, and Supabase rejects it because an account with
// this email already exists. There's no new user id to link the purchase to
// in that case, so unlike /api/link-purchase we have to find the existing
// account by email (via the admin API — GoTrue has no direct getUserByEmail,
// so this paginates listUsers()) and link the purchase to it instead. Without
// this, a repeat customer's new purchase would stay unlinked (user_id null)
// and never show up in their library even after they log in.
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { purchaseId, email } = body ?? {}
  if (!purchaseId || !email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  const { data: purchase } = await sb.from('purchases').select('id,email,guest_email').eq('id', purchaseId).single()
  const purchaseEmail = purchase?.email?.toLowerCase()
  const guestEmail = purchase?.guest_email?.toLowerCase()
  const targetEmail = String(email).toLowerCase()
  if (!purchase || (purchaseEmail !== targetEmail && guestEmail !== targetEmail)) {
    return NextResponse.json({ error: 'Purchase email mismatch' }, { status: 403 })
  }

  let matchedUserId: string | null = null
  for (let page = 1; page <= 20 && !matchedUserId; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    const found = data.users.find((u: any) => u.email?.toLowerCase() === targetEmail)
    if (found) matchedUserId = found.id
    if (data.users.length < 1000) break // last page
  }

  if (!matchedUserId) return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })

  const { error: updateErr } = await sb.from('purchases')
    .update({ user_id: matchedUserId, account_created: true })
    .eq('id', purchaseId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
