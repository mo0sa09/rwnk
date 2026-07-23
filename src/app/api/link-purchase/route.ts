import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Links a guest purchase to a newly created account. Server-side only —
// purchases has no client-writable UPDATE policy by design. Verifies the
// caller actually owns both the auth user id and the purchase's email
// before writing, so a purchaseId/userId pair can't be used to hijack
// someone else's order.
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { purchaseId, userId, email } = body ?? {}
  if (!purchaseId || !userId || !email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  const { data: userRes, error: userErr } = await sb.auth.admin.getUserById(userId)
  if (userErr || !userRes?.user || userRes.user.email?.toLowerCase() !== String(email).toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: purchase } = await sb.from('purchases').select('id,email,guest_email').eq('id', purchaseId).single()
  const purchaseEmail = purchase?.email?.toLowerCase()
  const guestEmail = purchase?.guest_email?.toLowerCase()
  if (!purchase || (purchaseEmail !== String(email).toLowerCase() && guestEmail !== String(email).toLowerCase())) {
    return NextResponse.json({ error: 'Purchase email mismatch' }, { status: 403 })
  }

  const { error: updateErr } = await sb.from('purchases').update({ user_id: userId, account_created: true }).eq('id', purchaseId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
