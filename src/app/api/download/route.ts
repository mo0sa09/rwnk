import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any
  const { data: t } = await sb.from('download_tokens').select('id,purchase_id,user_id,expires_at,used_at').eq('token', token).single()
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  const { data: ok } = await sb.rpc('record_download', { p_purchase_id: t.purchase_id, p_user_id: t.user_id, p_ip: null, p_ua: null })
  if (!ok) return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 403 })
  await sb.from('download_tokens').update({ used_at: new Date().toISOString() }).eq('id', t.id)
  const { data: pu } = await sb.from('purchases').select('product_id').eq('id', t.purchase_id).single()
  const { data: pr } = await sb.from('products').select('file_path').eq('id', (pu as any)?.product_id).single()
  if (!(pr as any)?.file_path) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  const { data: signed } = await sb.storage.from('products').createSignedUrl((pr as any).file_path, 3600)
  if (!(signed as any)?.signedUrl) return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  return NextResponse.redirect((signed as any).signedUrl)
}
