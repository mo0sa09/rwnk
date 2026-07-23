import { supabase } from './supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8
}

// Centralized Arabic translation of common Supabase Auth error messages.
export function mapAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const m = raw.toLowerCase()

  if (m.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
  if (m.includes('email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المُرسل إليك'
  if (m.includes('already registered') || m.includes('user already registered')) return 'هذا البريد مسجّل مسبقاً — سجّلي الدخول بدلاً من ذلك'
  if (m.includes('password') && (m.includes('at least') || m.includes('should be') || m.includes('weak'))) return 'كلمة المرور ضعيفة جداً — استخدمي 8 أحرف على الأقل'
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كثيرة جداً، يرجى المحاولة لاحقاً'
  if (m.includes('invalid email')) return 'صيغة البريد الإلكتروني غير صحيحة'
  if (m.includes('network') || m.includes('fetch failed') || m.includes('failed to fetch')) return 'تعذّر الاتصال بالخادم — تحققي من اتصال الإنترنت'
  if (m.includes('user not found')) return 'لا يوجد حساب بهذا البريد الإلكتروني'
  if (m.includes('same password')) return 'كلمة المرور الجديدة يجب أن تختلف عن الحالية'

  return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى'
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, fullName: string, phone?: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, phone }, emailRedirectTo: `${APP_URL}/auth/callback` },
  })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${APP_URL}/auth/callback` },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?next=/account`,
  })
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function updateProfile(userId: string, updates: Record<string, string>) {
  const { error } = await (supabase as any).from('profiles').update(updates).eq('id', userId)
  if (error) throw error
}

export async function createAccountAfterPurchase(email: string, password: string, purchaseId: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { source: 'purchase', purchase_id: purchaseId }, emailRedirectTo: `${APP_URL}/auth/callback?next=/library` },
  })
  if (error?.message?.toLowerCase().includes('already registered')) {
    // Existing customer buying again — link this new purchase to their
    // existing account so it shows up in their library once they log back
    // in, then send them a reset link (they've likely forgotten their
    // password since this could be their first purchase since signing up).
    if (purchaseId) {
      try {
        await fetch('/api/link-existing-purchase', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseId, email }),
        })
      } catch { /* non-fatal — support can link it manually if this fails */ }
    }
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_URL}/auth/callback?next=/library` })
    return { alreadyExists: true, user: null }
  }
  if (error) throw error

  // Link the purchase to the new account so it shows up in their library.
  // Uses the just-created user's id directly since a session may not exist
  // yet (email confirmation can be required before cookies are set).
  if (data.user && purchaseId) {
    try {
      await fetch('/api/link-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, userId: data.user.id, email }),
      })
    } catch { /* non-fatal — support can link it manually if this fails */ }
  }

  return { user: data.user, alreadyExists: false }
}

export async function setPasswordFromToken(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  return data
}
