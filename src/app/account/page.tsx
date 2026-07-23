'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import { updateProfile, signOut } from '@/lib/auth'
const P='#6747B2',PL='#EDE8FF',T1='#1A1228',T2='#4A4060',T3='#9890AA',BR='#EDE8F5'
export default function AccountPage() {
  const [user,setUser]=useState<any>(null)
  const [profile,setProfile]=useState<any>(null)
  const [purchases,setPurchases]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [editMode,setEditMode]=useState(false)
  const [form,setForm]=useState({full_name:'',phone:''})
  useEffect(()=>{
    async function load(){
      const {data:{user}}=await supabase.auth.getUser()
      if(!user){window.location.href='/login';return}
      setUser(user)
      const {data:p}=await (supabase as any).from('profiles').select('*').eq('id',user.id).single()
      if(p){setProfile(p);setForm({full_name:p.full_name??'',phone:p.phone??''})}
      try{const {data:pu}=await (supabase as any).from('user_library').select('*');setPurchases(pu??[])}catch{}
      setLoading(false)
    }
    load()
  },[])
  async function handleSave(){
    if(!user) return
    setSaving(true)
    try{await updateProfile(user.id,form);setProfile((p:any)=>({...p,...form}));setEditMode(false)}
    catch{alert('حدث خطأ في الحفظ')}
    finally{setSaving(false)}
  }
  if(loading) return <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Th',serif",color:T3}}>جاري التحميل...</div>
  const name=profile?.full_name||user?.email?.split('@')[0]||'مستخدم'
  const inp:React.CSSProperties={width:'100%',height:44,background:'#FAFAFA',border:`1px solid ${BR}`,borderRadius:10,padding:'0 12px',fontSize:13,color:T1,outline:'none',fontFamily:"'Th',serif"}
  const focus=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=P;e.target.style.boxShadow='0 0 0 3px rgba(103,71,178,.1)'}
  const blur=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=BR;e.target.style.boxShadow='none'}
  return (
    <>
      <Navbar rightContent={
        <div style={{display:'flex',alignItems:'center',gap:6,fontFamily:"'Th',serif"}}>
          <Link href="/library" style={{fontSize:13,color:T2,padding:'7px 14px',borderRadius:8,textDecoration:'none'}}>المكتبة</Link>
          <button onClick={async()=>{await signOut();window.location.href='/'}} style={{fontSize:13,color:'#A32D2D',background:'none',border:'none',padding:'7px 14px',borderRadius:8,fontFamily:"'Th',serif",cursor:'pointer'}}>خروج</button>
        </div>
      }/>
      <main style={{minHeight:'100vh',background:'#FAFAFA',paddingTop:78,paddingBottom:48,fontFamily:"'Th','Noto Kufi Arabic',serif"}}>
        <div style={{maxWidth:720,margin:'0 auto',padding:'0 24px'}}>
          <h1 style={{fontSize:26,fontWeight:900,letterSpacing:-0.7,marginBottom:4,color:T1}}>حسابي</h1>
          <p style={{fontSize:13,color:T3,marginBottom:28}}>إدارة معلوماتك وطلباتك</p>
          <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:'22px 24px',display:'flex',flexWrap:'wrap',alignItems:'center',gap:18,marginBottom:14}}>
            <div style={{width:62,height:62,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#6747B2,#8b6dd4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:'#fff',boxShadow:'0 4px 16px rgba(103,71,178,.3)'}}>{name.charAt(0)}</div>
            <div style={{flex:'1 1 160px',minWidth:0}}>
              <div style={{fontSize:17,fontWeight:900,color:T1,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
              <div style={{fontSize:13,color:T3,marginBottom:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
              <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:999,background:PL,color:P,border:'.5px solid #DDD6F0'}}>{user?.email_confirmed_at?'حساب موثّق':'⏳ في انتظار التوثيق'}</span>
            </div>
            <button onClick={()=>setEditMode(!editMode)} style={{height:44,padding:'0 16px',background:editMode?PL:'#fff',border:`1px solid ${editMode?P:BR}`,borderRadius:9,fontSize:12,fontWeight:700,color:editMode?P:T2,cursor:'pointer',fontFamily:"'Th',serif",flexShrink:0}}>{editMode?'إلغاء':'تعديل'}</button>
          </div>
          <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:'20px 24px',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <span style={{fontSize:14,fontWeight:900,color:T1}}>المعلومات الشخصية</span>
            </div>
            {editMode?<div>
              <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:6}}>الاسم الكامل</label><input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} style={inp} onFocus={focus} onBlur={blur}/></div>
              <div style={{marginBottom:16}}><label style={{display:'block',fontSize:11,fontWeight:700,color:T2,textTransform:'uppercase',letterSpacing:0.4,marginBottom:6}}>رقم الجوال</label><input value={form.phone} dir="ltr" onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+965 XXXX XXXX" style={inp} onFocus={focus} onBlur={blur}/></div>
              <button onClick={handleSave} disabled={saving} style={{height:44,padding:'0 24px',background:saving?'#8b6dd4':P,color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:900,cursor:saving?'wait':'pointer',fontFamily:"'Th',serif"}}>{saving?'جاري الحفظ...':'حفظ التغييرات'}</button>
            </div>:[
              {label:'الاسم الكامل',value:profile?.full_name||'—'},{label:'البريد الإلكتروني',value:user?.email,ltr:true},
              {label:'رقم الجوال',value:profile?.phone||'—',ltr:true},{label:'الدولة',value:profile?.country==='KW'?'الكويت':profile?.country||'—'},
            ].map((r,i,a)=>(
              <div key={i} style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:'4px 12px',padding:'11px 0',borderBottom:i<a.length-1?`.5px solid ${BR}`:'none'}}>
                <span style={{fontSize:12,color:T3,flexShrink:0}}>{r.label}</span>
                <span style={{fontSize:13,fontWeight:700,color:T1,wordBreak:'break-all',textAlign:'left'}} dir={r.ltr?'ltr':'rtl'}>{r.value}</span>
              </div>
            ))}
          </div>
          <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:'20px 24px',marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:900,color:T1,marginBottom:14}}>مشترياتي</div>
            {purchases.length===0?<div style={{textAlign:'center',padding:'16px 0',fontSize:13,color:T3}}>لا توجد مشتريات — <Link href="/checkout" style={{color:P,fontWeight:700,textDecoration:'none'}}>اشترِ الآن</Link></div>
            :purchases.map((p:any,i:number)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:14,paddingTop:i>0?12:0,borderTop:i>0?`1px solid ${BR}`:'none'}}>
                <div style={{width:40,height:54,borderRadius:9,flexShrink:0,background:'linear-gradient(145deg,#6747B2,#8b6dd4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📖</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:T1,marginBottom:2}}>{p.product_name}</div>
                  <div style={{fontSize:11,color:T3}}>{p.invoice_number} · {new Date(p.created_at).toLocaleDateString('ar-KW')}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                  <span style={{fontSize:15,fontWeight:900,color:P}}>{p.amount} د.ك</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:999,background:'#E1F5EE',color:'#085041'}}>مكتمل</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:20,padding:'18px 24px'}}>
            <div style={{fontSize:13,fontWeight:900,color:'#991B1B',marginBottom:5}}>منطقة الخطر</div>
            <p style={{fontSize:12,color:'#B91C1C',marginBottom:14,lineHeight:1.6}}>حذف الحساب سيؤدي إلى فقدان جميع مشترياتك وبياناتك بشكل نهائي.</p>
            <button style={{height:36,padding:'0 16px',background:'#fff',border:'1px solid #FECACA',borderRadius:9,fontSize:12,fontWeight:700,color:'#991B1B',cursor:'pointer',fontFamily:"'Th',serif"}}>حذف الحساب نهائياً</button>
          </div>
        </div>
      </main>
    </>
  )
}
