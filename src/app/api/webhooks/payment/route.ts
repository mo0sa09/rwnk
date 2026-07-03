import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  const { purchaseId, paymentRef, status } = await request.json()
  if (!purchaseId) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) as any
  if (status === 'success') await sb.from('purchases').update({ status: 'completed', payment_ref: paymentRef }).eq('id', purchaseId)
  else if (status === 'failed') await sb.from('purchases').update({ status: 'failed' }).eq('id', purchaseId)
  return NextResponse.json({ received: true })
}
