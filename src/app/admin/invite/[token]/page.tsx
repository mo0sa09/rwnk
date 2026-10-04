'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconShieldLock, IconLock, IconAlertTriangle } from '@tabler/icons-react'
import { C } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { resetPassword } from '@/lib/auth'

type Step = 'loading' | 'invalid' | 'form' | 'done' | 'reset_sent'

interface InvitationInfo {
  email: string
  name: string | null
  role: 'admin' | 'staff'
}

const ROLE_LABEL: Record<InvitationInfo['role'], string> = { admin: 'مشرف', staff: 'عضو فريق' }

// Dedicated acceptance flow for an admin/staff invitation — deliberately
// NOT the customer /register page or form. The token in the URL is the
// only credential: this page never asks for or trusts anything else about
// who the visitor is.
export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token

  const [step, setStep] = useState<Step>('loading')
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/invite/verify?token=${encodeURIComponent(token)}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.data) { setStep('invalid'); return }
        setInfo(json.data)
        setStep('form')
      } catch {
        if (!cancelled) setStep('invalid')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = C.primary; e.target.style.boxShadow = '0 0 0 3px rgba(103,71,178,.1)' }
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none' }
  const inp: React.CSSProperties = { width: '100%', height: 44, background: '#FAFAFA', border: `1px solid ${C.border}`, borderRadius: 11, padding: '0 14px', fontSize: 13, color: C.text1, outline: 'none', fontFamily: "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif", direction: 'ltr', transition: 'all .2s' }

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    if (pwd.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    if (pwd !== pwd2) { setError('كلمتا المرور غير متطابقتين'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/admin/invite/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pwd }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ')

      if (json.alreadyExists) {
        // A real password already existed on this account (e.g. the
        // invited email belongs to an existing customer) — never
        // overwritten server-side. Same fallback /success's account-
        // creation form uses: send a reset link so they prove inbox
        // ownership before anything about their credentials changes.
        await resetPassword(json.email)
        setStep('reset_sent')
        return
      }

      // Password was just set server-side — sign in now so the admin
      // actually lands authenticated, same pattern createAccountAfterPurchase
      // uses on /success.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: json.email, password: pwd })
      if (signInErr) throw signInErr
      setStep('done')
      router.push('/admin')
    } catch (err: any) {
      setError(err.message ?? 'حدث خطأ غير متوقع')
    }
    setSubmitting(false)
  }

  const shellStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif", direction: 'rtl', background: '#F8F7FF' }
  const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 440, padding: 'clamp(28px,6vw,40px)', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 22, boxShadow: '0 4px 24px rgba(103,71,178,.07),0 16px 48px rgba(103,71,178,.05)' }

  if (step === 'loading') {
    return <div style={shellStyle}><div style={{ color: C.text3, fontSize: 14 }}>جاري التحقق من الدعوة...</div></div>
  }

  if (step === 'invalid') {
    return (
      <div style={shellStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: C.errorBg, border: '1.5px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconAlertTriangle size={26} color="#A32D2D" />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8, color: C.text1 }}>رابط الدعوة غير صالح</h1>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, marginBottom: 20 }}>هذا الرابط غير صحيح أو منتهي الصلاحية أو تم استخدامه مسبقاً. تواصلي مع المالك لإرسال دعوة جديدة.</p>
          <Link href="/login" style={{ display: 'inline-block', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 900, padding: '11px 22px', borderRadius: 11, textDecoration: 'none' }}>الذهاب لتسجيل الدخول</Link>
        </div>
      </div>
    )
  }

  if (step === 'reset_sent') {
    return (
      <div style={shellStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: C.secondaryBg, border: '1.5px solid #5DCAA5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconShieldLock size={26} color="#085041" />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8, color: C.text1 }}>لديك حساب مسبق بهذا البريد</h1>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, marginBottom: 20 }}>تم منحك صلاحية الدخول للوحة التحكم. أرسلنا رابط تعيين كلمة مرور جديدة إلى بريدك — افتحيه لتسجيل الدخول.</p>
          <Link href="/login" style={{ display: 'inline-block', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 900, padding: '11px 22px', borderRadius: 11, textDecoration: 'none' }}>الذهاب لتسجيل الدخول</Link>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return <div style={shellStyle}><div style={{ color: C.text3, fontSize: 14 }}>تم قبول الدعوة، جاري تحويلك إلى لوحة التحكم...</div></div>
  }

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconShieldLock size={26} color={C.primary} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6, color: C.text1 }}>دعوة للانضمام إلى لوحة تحكم رَوْنَق</h1>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.65 }}>
            تمت دعوتك بصلاحية <strong style={{ color: C.text1 }}>{info ? ROLE_LABEL[info.role] : ''}</strong> — عيّني كلمة مرور لإكمال حسابك
          </p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: C.text2, display: 'flex', justifyContent: 'space-between' }}>
          <span>البريد الإلكتروني</span>
          <span style={{ fontWeight: 700, direction: 'ltr' }}>{info?.email}</span>
        </div>

        <form onSubmit={handleAccept}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="invite-pwd" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, textTransform: 'uppercase', marginBottom: 5 }}>كلمة المرور</label>
            <input id="invite-pwd" type="password" placeholder="8 أحرف على الأقل" autoComplete="new-password" value={pwd} onChange={e => setPwd(e.target.value)} onFocus={focus} onBlur={blur} style={inp} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="invite-pwd2" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, textTransform: 'uppercase', marginBottom: 5 }}>تأكيد كلمة المرور</label>
            <input id="invite-pwd2" type="password" placeholder="••••••••" autoComplete="new-password" value={pwd2} onChange={e => setPwd2(e.target.value)} onFocus={focus} onBlur={blur} style={inp} />
          </div>
          {error && <p role="alert" style={{ fontSize: 12, color: '#A32D2D', marginBottom: 12, padding: '8px 12px', background: '#FEF2F2', borderRadius: 8 }}>{error}</p>}
          <button type="submit" disabled={submitting} aria-busy={submitting} style={{ width: '100%', height: 46, background: submitting ? '#8b6dd4' : C.primary, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IconLock size={16} />
            {submitting ? 'جاري التفعيل...' : 'قبول الدعوة'}
          </button>
        </form>
      </div>
    </div>
  )
}
