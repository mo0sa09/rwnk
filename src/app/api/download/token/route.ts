import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { mintDownloadToken } from '@/lib/payment-access'

export const dynamic = 'force-dynamic'

// download_tokens has no INSERT policy for anon/authenticated by design —
// token creation only ever happens here, server-side, after real checks.
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }
  const purchaseId = typeof body?.purchaseId === 'string' ? body.purchaseId : ''
  if (!purchaseId) return NextResponse.json({ error: 'رقم الطلب مفقود' }, { status: 400 })

  const { url: sbUrl, key: sbKey } = getSupabaseServerEnv()
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  // If the caller is logged in, verify they own this purchase (defense in depth).
  // Guests (right after a fresh checkout, no account yet) are authorized by
  // knowing the purchaseId itself — an unguessable UUID never exposed publicly.
  let sessionUserId: string | null = null
  try {
    const { createServerClient } = await import('@supabase/ssr')
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const authed = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await authed.auth.getUser()
    sessionUserId = user?.id ?? null
  } catch { /* no session — treated as guest */ }

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  const { data: purchase, error } = await sb.from('purchases')
    .select('id,user_id,status,downloads_limit,downloads_used')
    .eq('id', purchaseId).single()

  if (error || !purchase) {
    console.error(`[download/token] purchase ${purchaseId} not found: ${error?.message ?? 'no row'}`)
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }
  if (purchase.status !== 'completed') {
    console.warn(`[download/token] purchase ${purchaseId} is not completed (status=${purchase.status}) — refusing token`)
    return NextResponse.json({ error: 'لم تكتمل عملية الدفع لهذا الطلب' }, { status: 403 })
  }
  if (sessionUserId && purchase.user_id && purchase.user_id !== sessionUserId) {
    console.error(`[download/token] session user ${sessionUserId} does not own purchase ${purchaseId} (owner=${purchase.user_id})`)
    return NextResponse.json({ error: 'غير مصرح لك بتحميل هذا الطلب' }, { status: 403 })
  }
  if ((purchase.downloads_used ?? 0) >= (purchase.downloads_limit ?? 0)) {
    console.warn(`[download/token] purchase ${purchaseId} hit its download limit (${purchase.downloads_used}/${purchase.downloads_limit})`)
    return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 403 })
  }

  const token = await mintDownloadToken(sb, purchase.id, sessionUserId ?? purchase.user_id ?? null)
  if (!token) {
    console.error(`[download/token] failed to create token for purchase ${purchaseId}`)
    return NextResponse.json({ error: 'تعذّر إنشاء رابط التحميل' }, { status: 500 })
  }

  console.log(`[download/token] issued token for purchase ${purchaseId} (user=${sessionUserId ?? purchase.user_id ?? 'guest'})`)
  return NextResponse.json({ token })
}
