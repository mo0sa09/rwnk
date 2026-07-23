'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signIn, signInWithGoogle, isValidEmail, mapAuthError, getCurrentUser, resetPassword } from '@/lib/auth'
import { C } from '@/lib/theme'
import {
  IconMail, IconEye, IconEyeOff,
  IconShieldCheck, IconBolt, IconStarFilled,
} from '@tabler/icons-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [checking, setChecking] = useState(true)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    let active = true
    getCurrentUser().then(user => {
      if (!active) return
      if (user) {
        const next = new URLSearchParams(window.location.search).get('next')
        window.location.href = next || '/library'
      } else {
        setChecking(false)
      }
    })
    return () => { active = false }
  }, [])

  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor=C.primary; e.target.style.boxShadow='0 0 0 3px rgba(103,71,178,.1)' }
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor=C.border;  e.target.style.boxShadow='none' }

  if (checking) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Th',serif", color:C.text3, fontSize:14 }}>
      جاري التحميل...
    </div>
  )

  const inpStyle: React.CSSProperties = {
    width:'100%', height:46, background:'#FAFAFA', border:`1px solid ${C.border}`,
    borderRadius:11, padding:'0 42px 0 14px', fontSize:14, color:C.text1,
    outline:'none', fontFamily:"'Th',serif", transition:'all .2s', direction:'ltr',
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('يرجى إدخال البريد وكلمة المرور'); return }
    if (!isValidEmail(email)) { setError('صيغة البريد الإلكتروني غير صحيحة'); return }
    setLoading(true); setError('')
    try {
      await signIn(email, password)
      const next = new URLSearchParams(window.location.search).get('next')
      window.location.href = next || '/library'
    } catch (err) {
      setError(mapAuthError(err))
    } finally { setLoading(false) }
  }

  async function handleForgotPassword() {
    if (!email) { setError('أدخلي بريدك الإلكتروني أولاً ثم اضغطي "نسيت كلمة المرور؟"'); return }
    if (!isValidEmail(email)) { setError('صيغة البريد الإلكتروني غير صحيحة'); return }
    setError(''); setResetSent(false)
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (err) {
      setError(mapAuthError(err))
    }
  }

  return (
    <div className="auth-shell" style={{ width:'100vw', height:'100vh', overflow:'hidden', display:'grid', gridTemplateColumns:'1fr 1fr', fontFamily:"'Th','Noto Kufi Arabic',serif", direction:'rtl' }}>

      {/* Left: Brand panel */}
      <div className="auth-brand-panel" style={{ background: C.text1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:48, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'15%', left:'25%', width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle,rgba(103,71,178,0.38) 0%,transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'8%', right:'8%', width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(54,219,156,0.14) 0%,transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', zIndex:1, textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:44 }}>
            <Image src="/logo-icon.png" alt="رَوْنَق" width={34} height={34} style={{ objectFit:'contain' }} />
            <span style={{ fontSize:22, fontWeight:900, color:'#fff' }}>رَوْنَق</span>
          </div>
          <div style={{ width:180, height:240, borderRadius:18, margin:'0 auto 36px', background:'linear-gradient(145deg,#7c5cd4,#5535a8)', boxShadow:'0 40px 80px rgba(0,0,0,0.5),0 0 60px rgba(103,71,178,0.38)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%)' }} />
            <span style={{ fontSize:36, position:'relative', zIndex:1 }}>📖</span>
            <span style={{ color:'#fff', fontSize:20, fontWeight:900, position:'relative', zIndex:1 }}>رَوْنَق</span>
            <span style={{ color:'rgba(255,255,255,0.5)', fontSize:10, position:'relative', zIndex:1 }}>دليل التنظيف الاحترافي</span>
          </div>
          <div style={{ display:'flex', gap:28, justifyContent:'center', marginBottom:28 }}>
            {[{n:'+500',l:'نسخة'},{n:'4.9',l:'تقييم'},{n:'7 أيام',l:'ضمان'}].map((s,i)=>(
              <div key={i} style={{ textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>{s.n}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {[
              { icon: IconStarFilled,  text:'4.9 متوسط التقييم' },
              { icon: IconShieldCheck, text:'ضمان استرجاع 7 أيام' },
              { icon: IconBolt,        text:'تحميل فوري بعد الدفع' },
            ].map(({icon:Icon,text})=>(
              <div key={text} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontSize:12, color:'rgba(255,255,255,0.3)' }}>
                <Icon size={13} color="rgba(255,255,255,0.3)" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="auth-form-panel" style={{ background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 52px', position:'relative', backgroundImage:'radial-gradient(circle, rgba(103,71,178,0.04) 1px, transparent 1px)', backgroundSize:'28px 28px' }}>
        <div style={{ width:'100%', maxWidth:340, position:'relative', zIndex:1 }}>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
            <Link href="/" style={{ fontSize:12, color:C.text3, textDecoration:'none' }}>رَوْنَق ←</Link>
            <span style={{ fontSize:12, color:C.text3 }}>
              ليس لديك حساب؟{' '}
              <Link href="/register" style={{ color:C.primary, fontWeight:700, textDecoration:'none' }}>سجّلي</Link>
            </span>
          </div>

          <div style={{ width:38, height:38, borderRadius:10, background:C.primary, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18, boxShadow:'0 4px 14px rgba(103,71,178,.3)' }}>
            <Image src="/logo-icon.png" alt="" width={20} height={20} style={{ objectFit:'contain' }} />
          </div>
          <h1 style={{ fontSize:23, fontWeight:900, color:C.text1, letterSpacing:-0.7, marginBottom:5 }}>مرحباً بعودتك</h1>
          <p style={{ fontSize:13, color:C.text3, marginBottom:22 }}>سجّلي دخولك للوصول إلى دليلك</p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:12 }}>
              <label htmlFor="login-email" style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>البريد الإلكتروني</label>
              <div style={{ position:'relative' }}>
                <input id="login-email" type="email" autoComplete="email" required placeholder="example@email.com" value={email} onChange={e=>setEmail(e.target.value)} onFocus={focus} onBlur={blur} style={inpStyle} />
                <IconMail size={16} color={C.text4} aria-hidden="true" style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
              </div>
            </div>

            <div style={{ marginBottom:8 }}>
              <label htmlFor="login-password" style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>كلمة المرور</label>
              <div style={{ position:'relative' }}>
                <input id="login-password" type={showPwd?'text':'password'} autoComplete="current-password" required placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onFocus={focus} onBlur={blur} style={inpStyle} />
                <button type="button" onClick={()=>setShowPwd(!showPwd)} aria-label={showPwd ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPwd} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:C.text4, display:'flex', alignItems:'center' }}>
                  {showPwd ? <IconEyeOff size={16}/> : <IconEye size={16}/>}
                </button>
              </div>
            </div>

            {error && <p role="alert" style={{ fontSize:12, color:'#A32D2D', marginBottom:10, padding:'8px 12px', background:'#FEF2F2', borderRadius:8 }}>{error}</p>}
            {resetSent && <p role="status" style={{ fontSize:12, color:'#085041', marginBottom:10, padding:'8px 12px', background:'#E1F5EE', borderRadius:8 }}>تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني</p>}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <span style={{ fontSize:12, color:C.text2 }}>تذكرني</span>
              <button type="button" onClick={handleForgotPassword} style={{ fontSize:12, fontWeight:700, color:C.primary, background:'none', border:'none', cursor:'pointer', fontFamily:"'Th',serif" }}>نسيت كلمة المرور؟</button>
            </div>

            <button type="submit" disabled={loading} style={{ width:'100%', height:48, background:loading?'#8b6dd4':C.primary, color:'#fff', border:'none', borderRadius:11, fontSize:14, fontWeight:900, cursor:loading?'wait':'pointer', fontFamily:"'Th',serif", boxShadow:'0 2px 12px rgba(103,71,178,.28)', transition:'all .2s' }}>
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'14px 0' }}>
            <div style={{ flex:1, height:1, background:C.border }} />
            <span style={{ fontSize:11, color:C.text4 }}>أو</span>
            <div style={{ flex:1, height:1, background:C.border }} />
          </div>

          <button onClick={signInWithGoogle} style={{ width:'100%', height:44, background:'#fff', border:`1px solid ${C.border}`, borderRadius:11, fontSize:13, fontWeight:700, color:C.text2, display:'flex', alignItems:'center', justifyContent:'center', gap:9, cursor:'pointer', fontFamily:"'Th',serif" }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            المتابعة بحساب Google
          </button>

          <p style={{ marginTop:14, textAlign:'center', fontSize:12, color:C.text3 }}>
            ليس لديك حساب؟{' '}
            <Link href="/register" style={{ color:C.primary, fontWeight:700, textDecoration:'none' }}>أنشئي حسابك مجاناً</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
