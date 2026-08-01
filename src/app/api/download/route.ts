import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { resolveProductFilePath } from '@/lib/download-resolver'
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

  // '42703' (raw Postgres "undefined column") is what a SELECT on a missing
  // column returns — verified live against this project. Both selects below
  // fall back to their pre-bilingual column set on that error so a download
  // — the single most critical path in this app — never breaks just because
  // supabase/schema.sql §15 hasn't been applied to this database yet.
  const puResult = await sb.from('purchases').select('product_id,book_language').eq('id', t.purchase_id).single()
  let pu = puResult.data
  if (puResult.error?.code === '42703') {
    console.error('[download] purchases.book_language column not found — the migration in supabase/schema.sql §15 has not been run. Falling back to language=ar for this download. RUN THE MIGRATION.')
    const retry = await sb.from('purchases').select('product_id').eq('id', t.purchase_id).single()
    pu = retry.data
  }

  const prResult = await sb.from('products').select('file_path,file_path_ar,file_path_en').eq('id', (pu as any)?.product_id).single()
  let pr = prResult.data
  if (prResult.error?.code === '42703') {
    console.error('[download] products.file_path_ar/file_path_en columns not found — the migration in supabase/schema.sql §15 has not been run. Falling back to the legacy single file_path. RUN THE MIGRATION.')
    const retry = await sb.from('products').select('file_path').eq('id', (pu as any)?.product_id).single()
    pr = retry.data
  }

  // book_language picks which of the two per-language files to serve — see
  // resolveProductFilePath (src/lib/download-resolver.ts) for the exact,
  // unit-tested rule: an Arabic request never receives file_path_en, and an
  // English request never receives file_path_ar unless file_path_en is
  // genuinely unconfigured (degraded=true), in which case it's logged as a
  // warning rather than silently pretending the right file was served.
  const { language, filePath, degraded } = resolveProductFilePath((pu as any)?.book_language, pr as any)

  if (degraded) {
    console.warn(`[download] purchase ${t.purchase_id} requested language=${language} but its primary file isn't configured — served a fallback (${filePath ?? 'none available'}) instead`)
  }
  if (!filePath) {
    console.error(`[download] product for purchase ${t.purchase_id} has no file configured for language=${language} (and no legacy file_path fallback either)`)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const { data: signed, error: signErr } = await sb.storage.from('products').createSignedUrl(filePath, 3600)
  if (!(signed as any)?.signedUrl) {
    console.error(`[download] failed to create signed URL for ${filePath}: ${signErr?.message ?? 'no signedUrl returned'}`)
    return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  }

  console.log(`[download] purchase ${t.purchase_id} (language=${language}) downloading ${filePath} — redirecting to signed URL (expires in 1h)`)
  return NextResponse.redirect((signed as any).signedUrl)
}
