'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { C } from '@/lib/theme'
import {
  IconCircleCheck, IconDownload, IconArrowRight,
  IconFileText, IconLock, IconUser, IconAlertTriangle,
} from '@tabler/icons-react'

interface PurchaseInfo {
  id: string
  invoice_number: string | null
  email: string
  amount: number
  currency: string
  status: string
  downloads_limit: number
  downloads_used: number
}

type Step = 'loading' | 'not_found' | 'pending' | 'success' | 'done'

export default function SuccessPage() {
  const [step, setStep]        = useState<Step>('loading')
  const [info, setInfo]        = useState<PurchaseInfo | null>(null)
  const [pwd, setPwd]          = useState('')
  const [pwd2, setPwd2]        = useState('')
  const [pwLoading, setPwLoad] = useState(false)
  const [pwError, setPwError]  = useState('')
  const [dlLoad, setDlLoad]    = useState(false)
  const [dlError, setDlError]  = useState('')
  const [alreadyUser, setAldy] = useState(false)

  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor=C.primary; e.target.style.boxShadow='0 0 0 3px rgba(103,71,178,.1)' }
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor=C.border;  e.target.style.boxShadow='none' }
  const inpS: React.CSSProperties = { width:'100%', height:44, background:'#FAFAFA', border:`1px solid ${C.border}`, borderRadius:11, padding:'0 14px', fontSize:13, color:C.text1, outline:'none', fontFamily:"'Th',serif", direction:'ltr', transition:'all .2s' }

  useEffect(() => {
    async function load() {
      const purchaseId = new URLSearchParams(window.location.search).get('purchaseId')
      if (!purchaseId) { setStep('not_found'); return }
      try {
        const res = await fetch(`/api/purchase-status?purchaseId=${encodeURIComponent(purchaseId)}`)
        const json = await res.json()
        if (!res.ok || !json.data) { setStep('not_found'); return }
        setInfo(json.data)
        setStep(json.data.status === 'completed' ? 'success' : 'pending')
      } catch {
        setStep('not_found')
      }
    }
    load()
  }, [])

  async function handleDownload() {
    if (!info?.id) return
    setDlLoad(true); setDlError('')
    try {
      const res = await fetch('/api/download/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: info.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error === 'LIMIT_REACHED' ? 'LIMIT_REACHED' : (json.error ?? 'ERROR'))
      window.open(`/api/download?token=${json.token}`, '_blank')
      setInfo(p => p ? { ...p, downloads_used: p.downloads_used + 1 } : p)
    } catch (err: any) {
      setDlError(err.message === 'LIMIT_REACHED' ? 'استنفذتِ عدد التحميلات المتاحة. تواصلي معنا لطلب تحميل إضافي.' : 'حدث خطأ أثناء تحضير رابط التحميل، حاولي مرة أخرى.')
    } finally { setDlLoad(false) }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!pwd || pwd.length < 8) { setPwError('كلمة المرور 8 أحرف على الأقل'); return }
    if (pwd !== pwd2) { setPwError('كلمتا المرور غير متطابقتين'); return }
    setPwLoad(true); setPwError('')
    try {
      const { createAccountAfterPurchase } = await import('@/lib/auth')
      const result = await createAccountAfterPurchase(info?.email ?? '', pwd, info?.id ?? '')
      if (result.alreadyExists) setAldy(true)
      setStep('done')
    } catch (err: any) {
      const { mapAuthError } = await import('@/lib/auth')
      setPwError(mapAuthError(err))
    }
    finally { setPwLoad(false) }
  }

  const dlLeft = (info?.downloads_limit ?? 0) - (info?.downloads_used ?? 0)

  if (step === 'loading') return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Th',serif", color:C.text3, fontSize:14 }}>
      جاري التحميل...
    </div>
  )

  if (step === 'not_found' || step === 'pending') return (
    <>
      <Navbar />
      <main style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', paddingTop:68, paddingBottom:40, fontFamily:"'Th','Noto Kufi Arabic',serif", direction:'rtl', background:'#fff' }}>
        <div style={{ width:'100%', maxWidth:440, padding:'40px 32px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', margin:'0 auto 16px', background:C.errorBg, border:'1.5px solid #FECACA', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <IconAlertTriangle size={26} color="#A32D2D" />
          </div>
          <h1 style={{ fontSize:20, fontWeight:900, marginBottom:8, color:C.text1 }}>
            {step === 'pending' ? 'عملية الدفع لم تكتمل بعد' : 'الطلب غير موجود'}
          </h1>
          <p style={{ fontSize:13, color:C.text3, lineHeight:1.7, marginBottom:24 }}>
            {step === 'pending'
              ? 'لم نستلم تأكيد الدفع لهذا الطلب بعد. إذا خُصم المبلغ من حسابك تواصلي معنا وسنساعدك فوراً.'
              : 'الرابط الذي فتحته غير صحيح أو منتهي الصلاحية. تحققي من رابط الطلب أو أعيدي المحاولة.'}
          </p>
          <Link href="/checkout" style={{ display:'inline-block', background:C.primary, color:'#fff', fontSize:13, fontWeight:900, padding:'12px 24px', borderRadius:11, textDecoration:'none' }}>
            العودة لصفحة الدفع
          </Link>
        </div>
      </main>
    </>
  )

  return (
    <>
      <Navbar rightContent={
        <Link href="/login" style={{ fontSize:12, color:C.text3, textDecoration:'none', padding:'6px 12px', borderRadius:7, border:`1px solid ${C.border}` }}>
          دخول العملاء
        </Link>
      } />

      <main style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', paddingTop:68, paddingBottom:40, fontFamily:"'Th','Noto Kufi Arabic',serif", direction:'rtl', background:'#fff', backgroundImage:'radial-gradient(ellipse 70% 55% at 50% 30%, rgba(54,219,156,0.05) 0%, transparent 70%)' }}>
        <div className="success-card" style={{ width:'100%', maxWidth:500, padding:'clamp(28px,7vw,44px) clamp(20px,6vw,40px)', background:'#fff', border:`1px solid ${C.border}`, borderRadius:24, boxShadow:'0 4px 24px rgba(103,71,178,.07),0 16px 48px rgba(103,71,178,.05)' }}>

          {/* Success header */}
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ width:64, height:64, borderRadius:'50%', margin:'0 auto 16px', background:C.secondaryBg, border:`1.5px solid #5DCAA5`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 8px rgba(54,219,156,0.08)' }}>
              <IconCircleCheck size={30} color="#085041" />
            </div>
            <h1 style={{ fontSize:23, fontWeight:900, letterSpacing:-0.6, marginBottom:6, color:C.text1 }}>تم الدفع بنجاح</h1>
            <p style={{ fontSize:13, color:C.text3, lineHeight:1.65 }}>كتاب رَوْنَق الآن ملكك — يمكنك تحميله مباشرة</p>
          </div>

          {/* Order summary */}
          {info && (
            <div style={{ background:C.primaryLight, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 16px', marginBottom:20 }}>
              {[
                { label:'رقم الطلب',     value: info.invoice_number ?? '—' },
                { label:'البريد',        value: info.email ?? '—'   },
                { label:'المبلغ المدفوع',value: `${info.amount} ${info.currency === 'KWD' ? 'د.ك' : info.currency}`, color: C.primary },
              ].map((r,i) => (
                <div key={i} style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', gap:'2px 12px', fontSize:12, marginBottom:i<2?7:0, direction:'rtl' }}>
                  <span style={{ color:C.text3, flexShrink:0 }}>{r.label}</span>
                  <span style={{ fontWeight:700, color: r.color ?? C.text1, wordBreak:'break-word', textAlign:'left' }}>{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Download section */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'16px 18px', marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <IconFileText size={16} color={C.text2} />
                <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>تحميل الكتاب</span>
              </div>
              <span style={{ fontSize:11, color:C.text3, background:'#fff', border:`1px solid ${C.border}`, padding:'3px 10px', borderRadius:999 }}>
                {dlLeft} من {info?.downloads_limit ?? 0} تحميل متبقي
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ height:4, background:C.border, borderRadius:999, marginBottom:14, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${((info?.downloads_used??0)/(info?.downloads_limit||1))*100}%`, background:C.primary, borderRadius:999, transition:'width .4s' }} />
            </div>
            {dlError && <p role="alert" style={{ fontSize:12, color:'#A32D2D', marginBottom:10, padding:'8px 12px', background:'#FEF2F2', borderRadius:8 }}>{dlError}</p>}
            <button onClick={handleDownload} disabled={dlLoad || dlLeft <= 0} aria-busy={dlLoad} style={{
              width:'100%', height:48, background:dlLeft<=0?C.text4:dlLoad?'#8b6dd4':C.primary, color:'#fff',
              border:'none', borderRadius:11, fontSize:14, fontWeight:900,
              cursor:dlLeft<=0?'not-allowed':dlLoad?'wait':'pointer',
              fontFamily:"'Th',serif", boxShadow:dlLeft>0?'0 2px 12px rgba(103,71,178,.28)':'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:9, transition:'all .2s',
            }}>
              <IconDownload size={18} />
              {dlLoad ? 'جاري التحضير...' : dlLeft<=0 ? 'استنفذتِ عدد التحميلات' : 'تحميل الكتاب الآن — PDF'}
            </button>
            {dlLeft <= 0 && (
              <p style={{ fontSize:11, color:'#A32D2D', textAlign:'center', marginTop:6 }}>تواصلي معنا لطلب تحميل إضافي</p>
            )}
          </div>

          {/* Create account */}
          {step === 'success' && (
            <div style={{ border:`1px solid ${C.border}`, borderRadius:14, padding:'16px 18px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <IconLock size={15} color={C.text2} />
                <span style={{ fontSize:13, fontWeight:900, color:C.text1 }}>احفظي وصولك للكتاب</span>
              </div>
              <p style={{ fontSize:12, color:C.text3, marginBottom:14, lineHeight:1.6 }}>
                أنشئي كلمة مرور لتتمكني من إعادة التحميل في أي وقت من مكتبتك.
              </p>
              <form onSubmit={handleCreateAccount}>
                <div style={{ marginBottom:10 }}>
                  <label htmlFor="success-pwd" style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>كلمة المرور</label>
                  <input id="success-pwd" type="password" placeholder="8 أحرف على الأقل" autoComplete="new-password" value={pwd} onChange={e=>setPwd(e.target.value)} onFocus={focus} onBlur={blur} style={inpS} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label htmlFor="success-pwd2" style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>تأكيد كلمة المرور</label>
                  <input id="success-pwd2" type="password" placeholder="••••••••" autoComplete="new-password" value={pwd2} onChange={e=>setPwd2(e.target.value)} onFocus={focus} onBlur={blur} style={inpS} />
                </div>
                {pwError && <p role="alert" style={{ fontSize:12, color:'#A32D2D', marginBottom:10, padding:'7px 12px', background:'#FEF2F2', borderRadius:8 }}>{pwError}</p>}
                <button type="submit" disabled={pwLoading} aria-busy={pwLoading} style={{ width:'100%', height:44, background:pwLoading?'#8b6dd4':C.primary, color:'#fff', border:'none', borderRadius:11, fontSize:13, fontWeight:900, cursor:pwLoading?'wait':'pointer', fontFamily:"'Th',serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <IconUser size={16} />
                  {pwLoading ? 'جاري الإنشاء...' : 'إنشاء حسابي وحفظ الوصول'}
                </button>
              </form>
              <button onClick={() => setStep('done')} style={{ width:'100%', marginTop:8, background:'none', border:'none', fontSize:12, color:C.text3, cursor:'pointer', fontFamily:"'Th',serif" }}>
                تجاهل — سأنشئ حساباً لاحقاً
              </button>
            </div>
          )}

          {/* Account created */}
          {step === 'done' && (
            <div style={{ background:C.secondaryBg, border:'1px solid #5DCAA5', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <IconCircleCheck size={20} color="#085041" />
              <div>
                <div style={{ fontSize:13, fontWeight:900, color:'#04342C' }}>
                  {alreadyUser ? 'تم إرسال رابط الدخول للبريد' : 'تم إنشاء حسابك بنجاح'}
                </div>
                <div style={{ fontSize:11, color:'#085041', marginTop:2 }}>يمكنك الآن الوصول للمكتبة في أي وقت</div>
              </div>
            </div>
          )}

          {/* Go to library */}
          <Link href="/library" style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            height:44, background:'#fff', border:`1px solid ${C.border}`, borderRadius:12,
            fontSize:13, fontWeight:700, color:C.text2, textDecoration:'none',
          }}>
            الذهاب إلى مكتبتي
            <IconArrowRight size={15} />
          </Link>

          <p style={{ textAlign:'center', fontSize:11, color:C.text3, marginTop:12 }}>
            تم إرسال إيصال الشراء إلى {info?.email ?? 'بريدك الإلكتروني'}
          </p>
        </div>
      </main>
    </>
  )
}
