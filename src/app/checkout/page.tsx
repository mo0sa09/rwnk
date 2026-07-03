'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
const P='#6747B2',PL='#EDE8FF',T1='#1A1228',T2='#4A4060',T3='#9890AA',BR='#EDE8F5'
const PM=[{id:'card',icon:'card',label:'بطاقة ائتمان'},{id:'knet',icon:'knet',label:'KNET'},{id:'apple',icon:'apple',label:'Apple Pay'}]
export default function CheckoutPage() {
  const [pm,setPm]=useState('card')
  const [email,setEmail]=useState('')
  const [loading,setLoading]=useState(false)
  const focus=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=P;e.target.style.boxShadow='0 0 0 3px rgba(103,71,178,.1)'}
  const blur=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=BR;e.target.style.boxShadow='none'}
  const inp:React.CSSProperties={width:'100%',height:42,background:'#FAFAFA',border:`1px solid ${BR}`,borderRadius:10,padding:'0 12px',fontSize:13,color:T1,outline:'none',fontFamily:"'Th',serif",transition:'all .2s'}
  async function handlePay(){
    if(!email){alert('يرجى إدخال البريد الإلكتروني');return}
    setLoading(true)
    try{
      sessionStorage.setItem('rwnq_purchase',JSON.stringify({email,productId:'a1b2c3d4-e5f6-7890-abcd-ef1234567890',amount:15,paymentMethod:pm,invoice:'RWN-2025-'+Math.floor(Math.random()*9000+1000),downloadsLimit:5,downloadsUsed:0}))
      await new Promise(r=>setTimeout(r,1200))
      window.location.href='/success'
    }finally{setLoading(false)}
  }
  return (
    <div style={{width:'100vw',height:'100vh',overflow:'hidden',display:'grid',gridTemplateColumns:'1fr 400px',fontFamily:"'Th','Noto Kufi Arabic',serif",direction:'rtl',background:'#fff'}}>
      <div style={{overflowY:'auto',padding:'32px 40px',backgroundImage:'radial-gradient(circle,rgba(103,71,178,0.04) 1px,transparent 1px)',backgroundSize:'28px 28px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}>
            <Image src="/logo-icon.png" alt="رَوْنَق" width={26} height={26} style={{objectFit:'contain'}}/>
            <span style={{fontSize:16,fontWeight:900,color:T1}}>رَوْنَق</span>
          </Link>
          <span style={{fontSize:12,color:T3}}>دفع آمن ومشفّر</span>
        </div>
        <h1 style={{fontSize:24,fontWeight:900,letterSpacing:-0.7,marginBottom:4,color:T1}}>إتمام الشراء</h1>
        <p style={{fontSize:13,color:T3,marginBottom:24}}>لا حاجة لإنشاء حساب — ادفعي واستلمي فوراً</p>
        <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:16,padding:20,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>بريدك الإلكتروني</div>
          <input type="email" placeholder="example@email.com" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} onFocus={focus} onBlur={blur} style={{...inp,height:48,fontSize:14}}/>
          <p style={{fontSize:11,color:T3,marginTop:6}}>سيُرسل الكتاب لهذا البريد · ستنشأ حسابك تلقائياً بعد الدفع</p>
        </div>
        <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:16,padding:20}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>طريقة الدفع</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
            {PM.map(m=><button key={m.id} onClick={()=>setPm(m.id)} style={{border:`1.5px solid ${pm===m.id?P:BR}`,background:pm===m.id?PL:'#fff',borderRadius:10,padding:'10px 8px',textAlign:'center',cursor:'pointer',fontFamily:"'Th',serif"}}>
              <div style={{fontSize:20,marginBottom:3}}>{m.icon}</div>
              <div style={{fontSize:11,fontWeight:700,color:T2}}>{m.label}</div>
            </button>)}
          </div>
          {pm==='card'&&<>
            <div style={{marginBottom:10}}><label style={{display:'block',fontSize:10,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:5}}>رقم البطاقة</label><input type="text" placeholder="1234 5678 9012 3456" dir="ltr" onFocus={focus} onBlur={blur} style={inp}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><label style={{display:'block',fontSize:10,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:5}}>تاريخ الانتهاء</label><input type="text" placeholder="MM / YY" dir="ltr" onFocus={focus} onBlur={blur} style={inp}/></div>
              <div><label style={{display:'block',fontSize:10,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:5}}>CVV</label><input type="text" placeholder="123" dir="ltr" onFocus={focus} onBlur={blur} style={inp}/></div>
            </div>
            <div><label style={{display:'block',fontSize:10,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:5}}>اسم حامل البطاقة</label><input type="text" placeholder="الاسم كما في البطاقة" onFocus={focus} onBlur={blur} style={inp}/></div>
          </>}
          {pm!=='card'&&<div style={{textAlign:'center',padding:'20px 0',fontSize:13,color:T3}}>سيتم التحويل لبوابة {pm==='knet'?'KNET':'Apple Pay'}</div>}
        </div>
      </div>
      <div style={{background:'#FAFAFA',borderRight:`1px solid ${BR}`,display:'flex',flexDirection:'column',padding:28,overflowY:'auto'}}>
        <div style={{fontSize:14,fontWeight:900,color:T1,marginBottom:18}}>ملخص الطلب</div>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:12,background:PL,borderRadius:12,marginBottom:18}}>
          <div style={{width:46,height:62,borderRadius:9,flexShrink:0,background:'linear-gradient(145deg,#6747B2,#8b6dd4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📖</div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:T1,marginBottom:2}}>كتاب رَوْنَق</div>
            <div style={{fontSize:11,color:T3}}>دليل التنظيف — PDF</div>
            <div style={{fontSize:11,fontWeight:700,color:P,marginTop:3}}>⚡ تحميل فوري + 5 تحميلات</div>
          </div>
        </div>
        <div style={{borderTop:`1px solid ${BR}`,paddingTop:14,marginBottom:14}}>
          {[{l:'سعر الكتاب',v:'15 د.ك'},{l:'ضريبة القيمة المضافة',v:'0 د.ك'},{l:'الشحن',v:'مجاني',g:true}].map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:9}}>
              <span style={{color:T3}}>{r.l}</span><span style={{fontWeight:700,color:r.g?'#085041':T1}}>{r.v}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderTop:`1px solid ${BR}`,marginBottom:16}}>
          <span style={{fontSize:14,fontWeight:900,color:T1}}>الإجمالي</span>
          <span style={{fontSize:26,fontWeight:900,color:P,letterSpacing:-0.5}}>15 <span style={{fontSize:13,fontWeight:400,color:T3}}>د.ك</span></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,background:'#E1F5EE',borderRadius:11,padding:'10px 12px',marginBottom:16}}>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#085041' strokeWidth='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>
          <div><div style={{fontSize:12,fontWeight:900,color:'#085041'}}>ضمان الاسترجاع 7 أيام</div><div style={{fontSize:11,color:'#0F6E56',marginTop:1}}>استرجاع كامل بدون أسئلة</div></div>
        </div>
        <button onClick={handlePay} disabled={loading} style={{width:'100%',height:52,background:loading?'#8b6dd4':P,color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:900,cursor:loading?'wait':'pointer',fontFamily:"'Th',serif",boxShadow:'0 2px 12px rgba(103,71,178,.28)'}}>
          {loading?'جاري المعالجة...':'ادفع الآن — 15 د.ك'}
        </button>
        <p style={{textAlign:'center',fontSize:11,color:T3,marginTop:8}}>مدفوعات مشفّرة وآمنة</p>
        <div style={{flex:1}}/>
        <Link href="/" style={{display:'block',textAlign:'center',fontSize:12,color:T3,marginTop:20,textDecoration:'none'}}>← العودة للرئيسية</Link>
      </div>
    </div>
  )
}
