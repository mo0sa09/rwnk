import { createClient } from '@supabase/supabase-js'
function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  ) as any
}
export async function createPurchase({ userId, productId, email, amount, paymentMethod }: { userId?: string; productId: string; email: string; amount: number; paymentMethod: string }) {
  const { data, error } = await getSb().from('purchases').insert({ user_id: userId ?? null, product_id: productId, email, amount, currency: 'KWD', status: 'pending', payment_method: paymentMethod }).select().single()
  if (error) throw error; return data
}
export async function completePurchase(purchaseId: string, paymentRef: string) {
  const { data, error } = await getSb().from('purchases').update({ status: 'completed', payment_ref: paymentRef }).eq('id', purchaseId).select().single()
  if (error) throw error; return data
}
export async function getUserPurchases() {
  const { data, error } = await getSb().from('user_purchases').select('*').order('created_at', { ascending: false })
  if (error) throw error; return data ?? []
}
export async function getUserLibrary() {
  const { data, error } = await getSb().from('user_library').select('*').order('created_at', { ascending: false })
  if (error) throw error; return data ?? []
}
export async function generateDownloadToken(purchaseId: string, userId: string) {
  const { data, error } = await getSb().from('download_tokens').insert({ purchase_id: purchaseId, user_id: userId }).select().single()
  if (error) throw error; return data.token
}
export async function generateDownloadTokenSafe(purchaseId: string, userId: string | null) {
  const sb = getSb()
  const { data: pu } = await sb.from('purchases').select('downloads_limit,downloads_used').eq('id', purchaseId).single()
  if (!pu) throw new Error('Purchase not found')
  if (pu.downloads_used >= pu.downloads_limit) throw new Error('LIMIT_REACHED')
  const { data, error } = await sb.from('download_tokens').insert({ purchase_id: purchaseId, user_id: userId }).select().single()
  if (error) throw error; return data.token
}
export async function linkPurchaseToUser(purchaseId: string, userId: string) {
  const { error } = await getSb().from('purchases').update({ user_id: userId, account_created: true }).eq('id', purchaseId)
  if (error) throw error
}
