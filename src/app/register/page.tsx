'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signUp, signInWithGoogle, isValidEmail, isValidPassword, mapAuthError, getCurrentUser } from '@/lib/auth'
const P='#6747B2',T1='#1A1228',T2='#4A4060',T3='#9890AA',BR='#EDE8F5'
export default function RegisterPage() {
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [checking,setChecking]=useState(true)
  const [form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',password:''})
  const set=(k:string)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm(f=>({...f,[k]:e.target.value}))
  const focus=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=P;e.target.style.boxShadow='0 0 0 3px rgba(103,71,178,.1)'}
  const blur=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=BR;e.target.style.boxShadow='none'}
  const inp:React.CSSProperties={width:'100%',height:44,background:'#FAFAFA',border:`1px solid ${BR}`,borderRadius:10,padding:'0 12px',fontSize:13,color:T1,outline:'none',fontFamily:"'Th',serif",transition:'all .2s'}

  useEffect(() => {
    let active = true
    getCurrentUser().then(user => {
      if (!active) return
      if (user) window.location.href = '/library'
      else setChecking(false)
    })
    return () => { active = false }
  }, [])

  if (checking) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Th',serif", color:T3, fontSize:14 }}>
      جاري التحميل...
    </div>
  )

  async function handle(e:React.FormEvent){
    e.preventDefault()
    if(!form.email||!form.password||!form.firstName){setError('يرجى ملء الحقول المطلوبة');return}
    if(!isValidEmail(form.email)){setError('صيغة البريد الإلكتروني غير صحيحة');return}
    if(!isValidPassword(form.password)){setError('كلمة المرور 8 أحرف على الأقل');return}
    setLoading(true);setError('');setSuccess('')
    try{
      const data=await signUp(form.email,form.password,`${form.firstName} ${form.lastName}`.trim(),form.phone)
      if(data.session){window.location.href='/checkout'}
      else{setSuccess('تم إنشاء حسابك بنجاح! تحققي من بريدك الإلكتروني لتأكيد الحساب ثم سجّلي الدخول.')}
    }
    catch(err){setError(mapAuthError(err))}
    finally{setLoading(false)}
  }
  return (
    <div className="auth-shell" style={{width:'100vw',height:'100vh',overflow:'hidden',display:'grid',gridTemplateColumns:'1fr 1fr',fontFamily:"'Th','Noto Kufi Arabic',serif",direction:'rtl'}}>
      <div className="auth-brand-panel" style={{background:T1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'20%',left:'30%',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(103,71,178,0.4) 0%,transparent 65%)',pointerEvents:'none'}}/>
        <div style={{position:'relative',zIndex:1,textAlign:'center'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:36}}>
            <Image src="/logo-icon.png" alt="رَوْنَق" width={36} height={36} style={{objectFit:'contain'}}/>
            <span style={{fontSize:22,fontWeight:900,color:'#fff'}}>رَوْنَق</span>
          </div>
          <div style={{width:160,height:210,borderRadius:14,margin:'0 auto 28px',background:'linear-gradient(145deg,#7c5cd4,#5535a8)',boxShadow:'0 40px 80px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
            <span style={{color:'#fff',fontSize:16,fontWeight:900}}>رَوْنَق</span>
          </div>
          <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',lineHeight:1.6}}>انضمي إلى +500 عائلة تستخدم رَوْنَق</p>
        </div>
      </div>
      <div className="auth-form-panel" style={{background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',padding:'28px 52px',backgroundImage:'radial-gradient(circle,rgba(103,71,178,0.04) 1px,transparent 1px)',backgroundSize:'28px 28px'}}>
        <div style={{width:'100%',maxWidth:340}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
            <Link href="/" style={{fontSize:12,color:T3,textDecoration:'none'}}>← رَوْنَق</Link>
            <span style={{fontSize:12,color:T3}}>لديك حساب؟ <Link href="/login" style={{color:P,fontWeight:700,textDecoration:'none'}}>دخول</Link></span>
          </div>
          <div style={{width:38,height:38,borderRadius:10,background:P,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:'#fff',marginBottom:14,boxShadow:'0 4px 14px rgba(103,71,178,.3)'}}>ر</div>
          <h1 style={{fontSize:22,fontWeight:900,color:T1,letterSpacing:-0.7,marginBottom:4}}>إنشاء حساب جديد</h1>
          <p style={{fontSize:12,color:T3,marginBottom:18}}>انضمي إلى +500 عائلة تستخدم رَوْنَق</p>
          {error&&<p role="alert" style={{fontSize:12,color:'#A32D2D',marginBottom:12,padding:'8px 12px',background:'#FEF2F2',borderRadius:8}}>{error}</p>}
          {success&&<p role="status" style={{fontSize:12,color:'#085041',marginBottom:12,padding:'10px 12px',background:'#E1F5EE',borderRadius:8,lineHeight:1.6}}>{success}</p>}
          {!success&&<form onSubmit={handle}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><label htmlFor="reg-firstName" style={{display:'block',fontSize:10,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:5}}>الاسم الأول *</label><input id="reg-firstName" autoComplete="given-name" required placeholder="نورة" value={form.firstName} onChange={set('firstName')} onFocus={focus} onBlur={blur} style={inp}/></div>
              <div><label htmlFor="reg-lastName" style={{display:'block',fontSize:10,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:5}}>الاسم الأخير</label><input id="reg-lastName" autoComplete="family-name" placeholder="العنزي" value={form.lastName} onChange={set('lastName')} onFocus={focus} onBlur={blur} style={inp}/></div>
            </div>
            {[{k:'email',l:'البريد الإلكتروني *',t:'email',ph:'example@email.com',ltr:true,ac:'email'},{k:'phone',l:'الجوال',t:'tel',ph:'+965 XXXX XXXX',ltr:true,ac:'tel'},{k:'password',l:'كلمة المرور *',t:'password',ph:'8 أحرف على الأقل',ltr:true,ac:'new-password'}].map(f=>(
              <div key={f.k} style={{marginBottom:10}}>
                <label htmlFor={`reg-${f.k}`} style={{display:'block',fontSize:10,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:5}}>{f.l}</label>
                <input id={`reg-${f.k}`} type={f.t} autoComplete={f.ac} required={f.k!=='phone'} placeholder={f.ph} dir={f.ltr?'ltr':'rtl'} value={form[f.k as keyof typeof form]} onChange={set(f.k)} onFocus={focus} onBlur={blur} style={inp}/>
              </div>
            ))}
            <p style={{fontSize:11,color:T3,textAlign:'center',marginBottom:12}}>بالتسجيل توافقين على <Link href="#" style={{color:P,fontWeight:700,textDecoration:'none'}}>شروط الاستخدام</Link></p>
            <button type="submit" disabled={loading} style={{width:'100%',height:46,background:loading?'#8b6dd4':P,color:'#fff',border:'none',borderRadius:11,fontSize:14,fontWeight:900,cursor:loading?'wait':'pointer',fontFamily:"'Th',serif",boxShadow:'0 2px 12px rgba(103,71,178,.28)'}}>
              {loading?'جاري الإنشاء...':'إنشاء الحساب ←'}
            </button>
          </form>}
          {!success&&<div style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0'}}>
            <div style={{flex:1,height:1,background:BR}}/><span style={{fontSize:11,color:'#C8C0D8'}}>أو</span><div style={{flex:1,height:1,background:BR}}/>
          </div>}
          {!success&&<button onClick={signInWithGoogle} style={{width:'100%',height:42,background:'#fff',border:`1px solid ${BR}`,borderRadius:11,fontSize:13,fontWeight:700,color:T2,display:'flex',alignItems:'center',justifyContent:'center',gap:9,cursor:'pointer',fontFamily:"'Th',serif"}}>
            <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            التسجيل بحساب Google
          </button>}
          {success&&<Link href="/login" style={{display:'block',width:'100%',textAlign:'center',height:46,lineHeight:'46px',background:P,color:'#fff',borderRadius:11,fontSize:14,fontWeight:900,textDecoration:'none',boxShadow:'0 2px 12px rgba(103,71,178,.28)'}}>الذهاب لتسجيل الدخول ←</Link>}
        </div>
      </div>
    </div>
  )
}
