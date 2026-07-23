'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CardBrandsIcon, KnetIcon, ApplePayIcon } from '@/components/ui/PaymentIcons'
import { getStoreSettings, DEFAULT_SETTINGS, type StoreSettings } from '@/lib/store-settings'
import { isValidEmail } from '@/lib/auth'

const P='#6747B2',PL='#EDE8FF',T1='#1A1228',T2='#4A4060',T3='#9890AA',BR='#EDE8F5'
const PM=[
  {id:'card',Icon:CardBrandsIcon,label:'بطاقة ائتمان'},
  {id:'knet',Icon:KnetIcon,label:'KNET'},
  {id:'apple',Icon:ApplePayIcon,label:'Apple Pay'},
]

const ERROR_MESSAGES: Record<string, string> = {
  payment_failed:   'لم تكتمل عملية الدفع أو تم إلغاؤها. يمكنك المحاولة مرة أخرى.',
  missing_purchase: 'انتهت صلاحية جلسة الدفع، يرجى إعادة المحاولة.',
  callback_error:   'حدث خطأ أثناء تأكيد الدفع. إذا تم خصم المبلغ تواصلي معنا فوراً.',
}

export default function CheckoutPage() {
  const [pm,setPm]=useState('card')
  const [email,setEmail]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [banner,setBanner]=useState('')
  const [settings,setSettings]=useState<StoreSettings>(DEFAULT_SETTINGS)
  const submitting = useRef(false)

  useEffect(() => {
    function init() {
      getStoreSettings().then(setSettings)
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error')
      if (err) setBanner(ERROR_MESSAGES[err] ?? 'تعذّر إتمام عملية الدفع. حاولي مرة أخرى.')
    }
    init()
  }, [])

  const focus=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=P;e.target.style.boxShadow='0 0 0 3px rgba(103,71,178,.1)'}
  const blur=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=BR;e.target.style.boxShadow='none'}
  const inp:React.CSSProperties={width:'100%',height:42,background:'#FAFAFA',border:`1px solid ${BR}`,borderRadius:10,padding:'0 12px',fontSize:13,color:T1,outline:'none',fontFamily:"'Th',serif",transition:'all .2s'}

  async function handlePay(){
    if (submitting.current || loading) return
    if (!email) { setError('يرجى إدخال البريد الإلكتروني'); return }
    if (!isValidEmail(email)) { setError('صيغة البريد الإلكتروني غير صحيحة'); return }

    submitting.current = true
    setLoading(true); setError(''); setBanner('')
    try {
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, paymentMethod: pm }),
      })
      const checkoutJson = await checkoutRes.json()
      if (!checkoutRes.ok) throw new Error(checkoutJson.error ?? 'تعذّر إنشاء الطلب')

      const payRes = await fetch('/api/payment/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: checkoutJson.purchaseId }),
      })
      const payJson = await payRes.json()
      if (!payRes.ok || !payJson.paymentUrl) throw new Error(payJson.error ?? 'تعذّر بدء عملية الدفع')

      window.location.href = payJson.paymentUrl
    } catch (err: any) {
      setError(err.message ?? 'حدث خطأ غير متوقع، حاولي مرة أخرى')
      submitting.current = false
      setLoading(false)
    }
  }

  const price = settings.product_price
  const priceLabel = `${price} د.ك`

  return (
    <div className="checkout-shell" style={{width:'100vw',minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 400px',fontFamily:"'Th','Noto Kufi Arabic',serif",direction:'rtl',background:'#fff'}}>
      <div className="checkout-col-main" style={{overflowY:'auto',padding:'clamp(20px,5vw,32px) clamp(16px,5vw,40px)',backgroundImage:'radial-gradient(circle,rgba(103,71,178,0.04) 1px,transparent 1px)',backgroundSize:'28px 28px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:8}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}>
            <Image src="/logo-icon.png" alt="رَوْنَق" width={26} height={26} style={{objectFit:'contain'}}/>
            <span style={{fontSize:16,fontWeight:900,color:T1}}>رَوْنَق</span>
          </Link>
          <span style={{fontSize:12,color:T3}}>دفع آمن ومشفّر</span>
        </div>
        <h1 style={{fontSize:24,fontWeight:900,letterSpacing:-0.7,marginBottom:4,color:T1}}>إتمام الشراء</h1>
        <p style={{fontSize:13,color:T3,marginBottom:24}}>لا حاجة لإنشاء حساب — ادفعي واستلمي فوراً</p>

        {banner && (
          <div role="alert" style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#A32D2D',lineHeight:1.6}}>
            {banner}
          </div>
        )}

        <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:16,padding:20,marginBottom:14}}>
          <label htmlFor="checkout-email" style={{display:'block',fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>بريدك الإلكتروني</label>
          <input id="checkout-email" type="email" placeholder="example@email.com" dir="ltr" autoComplete="email" required
            value={email} onChange={e=>{setEmail(e.target.value); if(error) setError('')}} onFocus={focus} onBlur={blur}
            aria-invalid={!!error} aria-describedby={error?'checkout-email-error':undefined}
            style={{...inp,height:48,fontSize:14}}/>
          <p style={{fontSize:11,color:T3,marginTop:6}}>سيُرسل الكتاب لهذا البريد · ستنشأ حسابك تلقائياً بعد الدفع</p>
          {error && <p id="checkout-email-error" role="alert" style={{fontSize:12,color:'#A32D2D',marginTop:8,padding:'8px 12px',background:'#FEF2F2',borderRadius:8}}>{error}</p>}
        </div>

        <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:16,padding:20}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>طريقة الدفع</div>
          <div className="checkout-pm-grid" role="radiogroup" aria-label="طريقة الدفع" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
            {PM.map(m=>(
              <button key={m.id} type="button" role="radio" aria-checked={pm===m.id} onClick={()=>setPm(m.id)}
                style={{minHeight:44,border:`1.5px solid ${pm===m.id?P:BR}`,background:pm===m.id?PL:'#fff',borderRadius:10,padding:'10px 8px',textAlign:'center',cursor:'pointer',fontFamily:"'Th',serif"}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:5}}><m.Icon height={20} /></div>
                <div style={{fontSize:11,fontWeight:700,color:T2}}>{m.label}</div>
              </button>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 4px',fontSize:12,color:T3,lineHeight:1.6}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            سيتم تحويلك إلى صفحة دفع آمنة تابعة لبوابة الدفع لإدخال بيانات البطاقة — لا نقوم بتخزين بيانات بطاقتك على موقعنا.
          </div>
        </div>
      </div>

      <div className="checkout-col-summary" style={{background:'#FAFAFA',borderRight:`1px solid ${BR}`,display:'flex',flexDirection:'column',padding:'clamp(20px,5vw,28px)',overflowY:'auto'}}>
        <div style={{fontSize:14,fontWeight:900,color:T1,marginBottom:18}}>ملخص الطلب</div>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:12,background:PL,borderRadius:12,marginBottom:18}}>
          <div style={{width:46,height:62,borderRadius:9,flexShrink:0,background:'linear-gradient(145deg,#6747B2,#8b6dd4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📖</div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:T1,marginBottom:2}}>{settings.product_name}</div>
            <div style={{fontSize:11,color:T3}}>دليل التنظيف — PDF</div>
            <div style={{fontSize:11,fontWeight:700,color:P,marginTop:3}}>⚡ تحميل فوري + {settings.downloads_limit} تحميلات</div>
          </div>
        </div>
        <div style={{borderTop:`1px solid ${BR}`,paddingTop:14,marginBottom:14}}>
          {[{l:'سعر الكتاب',v:priceLabel},{l:'ضريبة القيمة المضافة',v:'0 د.ك'},{l:'الشحن',v:'مجاني',g:true}].map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:9}}>
              <span style={{color:T3}}>{r.l}</span><span style={{fontWeight:700,color:r.g?'#085041':T1}}>{r.v}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderTop:`1px solid ${BR}`,marginBottom:16}}>
          <span style={{fontSize:14,fontWeight:900,color:T1}}>الإجمالي</span>
          <span style={{fontSize:26,fontWeight:900,color:P,letterSpacing:-0.5}}>{price} <span style={{fontSize:13,fontWeight:400,color:T3}}>د.ك</span></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,background:'#E1F5EE',borderRadius:11,padding:'10px 12px',marginBottom:16}}>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#085041' strokeWidth='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>
          <div><div style={{fontSize:12,fontWeight:900,color:'#085041'}}>ضمان الاسترجاع 7 أيام</div><div style={{fontSize:11,color:'#0F6E56',marginTop:1}}>استرجاع كامل بدون أسئلة</div></div>
        </div>
        <button onClick={handlePay} disabled={loading} aria-busy={loading} style={{width:'100%',height:52,background:loading?'#8b6dd4':P,color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:900,cursor:loading?'wait':'pointer',fontFamily:"'Th',serif",boxShadow:'0 2px 12px rgba(103,71,178,.28)'}}>
          {loading?'جاري التحويل لبوابة الدفع...':`ادفع الآن — ${priceLabel}`}
        </button>
        <p style={{textAlign:'center',fontSize:11,color:T3,marginTop:8}}>مدفوعات مشفّرة وآمنة</p>
        <div style={{flex:1}}/>
        <Link href="/" style={{display:'block',textAlign:'center',fontSize:12,color:T3,marginTop:20,textDecoration:'none'}}>← العودة للرئيسية</Link>
      </div>
    </div>
  )
}
