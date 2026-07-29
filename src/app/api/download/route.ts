import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    console.error('[download] request has no token')
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }
  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) {
    console.error('[download] Supabase service env not configured')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any

  const { data: t } = await sb.from('download_tokens').select('id,purchase_id,user_id,expires_at,used_at').eq('token', token).single()
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) {
    console.error(`[download] token rejected — ${!t ? 'not found' : t.used_at ? `already used at ${t.used_at}` : `expired at ${t.expires_at}`}`)
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  const { data: ok } = await sb.rpc('record_download', { p_purchase_id: t.purchase_id, p_user_id: t.user_id, p_ip: null, p_ua: null })
  if (!ok) {
    console.warn(`[download] purchase ${t.purchase_id} hit its download limit — record_download returned false`)
    return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 403 })
  }
  await sb.from('download_tokens').update({ used_at: new Date().toISOString() }).eq('id', t.id)

  const { data: pu } = await sb.from('purchases').select('product_id').eq('id', t.purchase_id).single()
  const { data: pr } = await sb.from('products').select('file_path').eq('id', (pu as any)?.product_id).single()
  if (!(pr as any)?.file_path) {
    console.error(`[download] product for purchase ${t.purchase_id} has no file_path configured`)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const { data: signed, error: signErr } = await sb.storage.from('products').createSignedUrl((pr as any).file_path, 3600)
  if (!(signed as any)?.signedUrl) {
    console.error(`[download] failed to create signed URL for ${(pr as any).file_path}: ${signErr?.message ?? 'no signedUrl returned'}`)
    return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  }

  console.log(`[download] purchase ${t.purchase_id} downloading ${(pr as any).file_path} — redirecting to signed URL (expires in 1h)`)
  return NextResponse.redirect((signed as any).signedUrl)
}
