'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { C } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { setPasswordFromToken, mapAuthError } from '@/lib/auth'
import { IconLock, IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react'

const FONT = "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif"

type Step = 'checking' | 'invalid' | 'form' | 'done'

// Landing page for the "نسيت كلمة المرور؟" email link. By the time this
// page renders, /auth/callback has already exchanged the recovery code for
// a real session (PKCE flow — see the comment on resetPassword() in
// src/lib/auth.ts), so this page's only job is: confirm that session
// exists, then let the customer actually type and submit a new password.
//
// This page did not exist before — resetPasswordForEmail() redirected to
// /account, which has no password field, so a customer who clicked the
// reset link had no way to finish resetting their password at all.
export default function ResetPasswordPage() {
  const [step, setStep] = useState<Step>('checking')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return
      setStep(user ? 'form' : 'invalid')
    })
    return () => { active = false }
  }, [])

  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = '0 0 0 3px rgba(103,71,178,.1)' }
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none' }
  const inpStyle: React.CSSProperties = { width: '100%', height: 46, background: '#FAFAFA', border: `1px solid ${C.border}`, borderRadius: 11, padding: '0 14px', fontSize: 14, color: C.text1, outline: 'none', fontFamily: FONT, direction: 'ltr', transition: 'all .2s' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pwd || pwd.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    if (pwd !== pwd2) { setError('كلمتا المرور غير متطابقتين'); return }
    setLoading(true); setError('')
    try {
      await setPasswordFromToken(pwd)
      setStep('done')
    } catch (err) {
      setError(mapAuthError(err))
    } finally { setLoading(false) }
  }

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 68, paddingBottom: 40, fontFamily: FONT, direction: 'rtl', background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 420, padding: '40px 32px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 24, boxShadow: '0 4px 24px rgba(103,71,178,.07),0 16px 48px rgba(103,71,178,.05)' }}>

          {step === 'checking' && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: C.text3, fontSize: 14 }}>جاري التحقق من الرابط...</div>
          )}

          {step === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: C.errorBg, border: '1.5px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconAlertTriangle size={26} color="#A32D2D" />
              </div>
              <h1 style={{ fontSize: 19, fontWeight: 900, marginBottom: 8, color: C.text1 }}>الرابط غير صالح أو منتهي الصلاحية</h1>
              <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, marginBottom: 24 }}>
                يرجى طلب رابط إعادة تعيين كلمة مرور جديد من صفحة تسجيل الدخول.
              </p>
              <Link href="/login" style={{ display: 'inline-block', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 900, padding: '12px 24px', borderRadius: 11, textDecoration: 'none' }}>
                العودة لتسجيل الدخول
              </Link>
            </div>
          )}

          {step === 'form' && (
            <>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 4px 14px rgba(103,71,178,.3)' }}>
                <IconLock size={20} color="#fff" />
              </div>
              <h1 style={{ fontSize: 21, fontWeight: 900, color: C.text1, marginBottom: 6 }}>تعيين كلمة مرور جديدة</h1>
              <p style={{ fontSize: 13, color: C.text3, marginBottom: 22, lineHeight: 1.6 }}>اختاري كلمة مرور جديدة لحسابك</p>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="rp-pwd" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, textTransform: 'uppercase', marginBottom: 5 }}>كلمة المرور الجديدة</label>
                  <input id="rp-pwd" type="password" placeholder="8 أحرف على الأقل" autoComplete="new-password" value={pwd} onChange={e => setPwd(e.target.value)} onFocus={focus} onBlur={blur} style={inpStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="rp-pwd2" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, textTransform: 'uppercase', marginBottom: 5 }}>تأكيد كلمة المرور</label>
                  <input id="rp-pwd2" type="password" placeholder="••••••••" autoComplete="new-password" value={pwd2} onChange={e => setPwd2(e.target.value)} onFocus={focus} onBlur={blur} style={inpStyle} />
                </div>
                {error && <p role="alert" style={{ fontSize: 12, color: '#A32D2D', marginBottom: 14, padding: '8px 12px', background: '#FEF2F2', borderRadius: 8 }}>{error}</p>}
                <button type="submit" disabled={loading} aria-busy={loading} style={{ width: '100%', height: 48, background: loading ? '#8b6dd4' : C.primary, color: '#fff', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 900, cursor: loading ? 'wait' : 'pointer', fontFamily: FONT, boxShadow: '0 2px 12px rgba(103,71,178,.28)' }}>
                  {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: C.secondaryBg, border: '1.5px solid #5DCAA5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCircleCheck size={26} color="#085041" />
              </div>
              <h1 style={{ fontSize: 19, fontWeight: 900, marginBottom: 8, color: C.text1 }}>تم تحديث كلمة المرور بنجاح</h1>
              <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, marginBottom: 24 }}>يمكنك الآن استخدام كلمة المرور الجديدة لتسجيل الدخول.</p>
              <Link href="/library" style={{ display: 'inline-block', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 900, padding: '12px 24px', borderRadius: 11, textDecoration: 'none' }}>
                الذهاب إلى مكتبتي
              </Link>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
