import { createClient } from '@supabase/supabase-js'
function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  )
}
export async function signIn(email: string, password: string) {
  const { data, error } = await getSb().auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export async function signUp(email: string, password: string, fullName: string, phone?: string) {
  const { data, error } = await getSb().auth.signUp({
    email, password,
    options: { data: { full_name: fullName, phone }, emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  })
  if (error) throw error
  return data
}
export async function signInWithGoogle() {
  const { error } = await getSb().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  })
  if (error) throw error
}
export async function signOut() { await getSb().auth.signOut() }
export async function updateProfile(userId: string, updates: Record<string, string>) {
  const { error } = await (getSb() as any).from('profiles').update(updates).eq('id', userId)
  if (error) throw error
}
export async function createAccountAfterPurchase(email: string, purchaseId: string) {
  const sb = getSb()
  const tempPwd = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16)
  const { data, error } = await sb.auth.signUp({
    email, password: tempPwd,
    options: { data: { source: 'purchase', purchase_id: purchaseId }, emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/library` },
  })
  if (error?.message?.includes('already registered')) {
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/library` })
    return { alreadyExists: true }
  }
  if (error) throw error
  return { user: data.user, alreadyExists: false }
}
export async function setPasswordFromToken(password: string) {
  const { data, error } = await getSb().auth.updateUser({ password })
  if (error) throw error
  return data
}
