import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { code, amount } = await request.json()
  if (!code || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any

  const { data, error } = await sb.rpc('apply_discount_code', { p_code: code, p_amount: amount })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = data?.[0]
  if (!result?.valid) return NextResponse.json({ valid: false, message: result?.message ?? 'كود غير صحيح' })

  return NextResponse.json({
    valid:         true,
    discountType:  result.discount_type,
    discountValue: result.discount_value,
    finalAmount:   result.final_amount,
    message:       result.message,
  })
}
