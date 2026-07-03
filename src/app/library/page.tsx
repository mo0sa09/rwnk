'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/auth'
import { generateDownloadTokenSafe } from '@/lib/purchases'
const P='#6747B2',PL='#EDE8FF',T1='#1A1228',T2='#4A4060',T3='#9890AA',BR='#EDE8F5'
const CHAPTERS=[{n:1,title:'أسس التنظيف الاحترافي',status:'done'},{n:2,title:'معايير كل غرفة',status:'done'},{n:3,title:'المنتجات والأدوات',status:'done'},{n:4,title:'الجداول والقوائم',status:'done'},{n:5,title:'التعامل مع الحالات الخاصة',status:'new'}]
export default function LibraryPage() {
  const [user,setUser]=useState<any>(null)
  const [library,setLibrary]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [dlState,setDlState]=useState<Record<string,string>>({})
  useEffect(()=>{
    async function load(){
      const {data:{user}}=await supabase.auth.getUser()
      if(!user){window.location.href='/login';return}
      setUser(user)
      try{
        const {data:lib}=await (supabase as any).from('user_library').select('*').order('created_at',{ascending:false})
        setLibrary(lib??[])
      }catch{
        const {data:p}=await (supabase as any).from('user_purchases').select('*')
        setLibrary(p??[])
      }
      setLoading(false)
    }
    load()
  },[])
  async function handleDownload(item:any){
    setDlState(s=>({...s,[item.id]:'loading'}))
    try{
      const token=await generateDownloadTokenSafe(item.id,user?.id)
      window.open(`/api/download?token=${token}`,'_blank')
      setLibrary(lib=>lib.map(p=>p.id===item.id?{...p,downloads_used:(p.downloads_used??0)+1,downloads_remaining:(p.downloads_remaining??5)-1}:p))
      setDlState(s=>({...s,[item.id]:'idle'}))
    }catch(err:any){
      if(err.message==='LIMIT_REACHED') alert('استنفذتِ عدد التحميلات. تواصلي معنا.')
      else alert('حدث خطأ في التحميل')
      setDlState(s=>({...s,[item.id]:'idle'}))
    }
  }
  if(loading) return <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Th',serif",color:T3}}>جاري التحميل...</div>
  return (
    <>
      <Navbar rightContent={
        <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:"'Th',serif"}}>
          <Link href="/account" style={{fontSize:13,color:T2,padding:'7px 14px',borderRadius:8,textDecoration:'none'}}>حسابي</Link>
          <button onClick={async()=>{await signOut();window.location.href='/'}} style={{fontSize:13,color:'#A32D2D',background:'none',border:'none',padding:'7px 14px',borderRadius:8,fontFamily:"'Th',serif",cursor:'pointer'}}>خروج</button>
        </div>
      }/>
      <main style={{minHeight:'100vh',background:'#FAFAFA',paddingTop:78,paddingBottom:48,fontFamily:"'Th','Noto Kufi Arabic',serif"}}>
        <div style={{maxWidth:860,margin:'0 auto',padding:'0 24px'}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:28}}>
            <h1 style={{fontSize:26,fontWeight:900,letterSpacing:-0.7,color:T1}}>مكتبتي </h1>
            <span style={{fontSize:13,color:T3}}>{library.length} منتج</span>
          </div>
          {library.length===0?<div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:'48px 32px',textAlign:'center'}}>
            
            <h2 style={{fontSize:18,fontWeight:900,color:T1,marginBottom:8}}>مكتبتك فارغة</h2>
            <p style={{fontSize:13,color:T3,marginBottom:24}}>لم تشتري أي منتج بعد</p>
            <Link href="/checkout" style={{background:P,color:'#fff',fontSize:14,fontWeight:900,padding:'12px 28px',borderRadius:12,textDecoration:'none',display:'inline-block'}}>اشترِ كتاب رَوْنَق الآن</Link>
          </div>:library.map((item:any)=>{
            const dlLeft=item.downloads_remaining??(item.downloads_limit??5)-(item.downloads_used??0)
            const dlUsed=item.downloads_used??0,dlLimit=item.downloads_limit??5
            const dlPct=Math.min((dlUsed/dlLimit)*100,100)
            const st=dlState[item.id]??'idle'
            const updatedAt=item.product_updated_at?new Date(item.product_updated_at).toLocaleDateString('ar-KW'):'—'
            return (
              <div key={item.id}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:14}}>
                  {[{n:dlLeft.toString(),l:'تحميل متبقي',sub:`من ${dlLimit}`,c:dlLeft>2?P:dlLeft>0?'#BA7517':'#A32D2D'},{n:item.product_version??'1.0',l:'الإصدار الحالي',sub:'آخر تحديث: '+updatedAt},{n:item.invoice_number?.slice(-4)??'—',l:'رقم الطلب',sub:new Date(item.created_at).toLocaleDateString('ar-KW')}].map((s,i)=>(
                    <div key={i} style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:'16px 0',textAlign:'center'}}>
                      <div style={{fontSize:20,fontWeight:900,color:s.c??P,marginBottom:3}}>{s.n}</div>
                      <div style={{fontSize:11,fontWeight:700,color:T2}}>{s.l}</div>
                      <div style={{fontSize:10,color:T3,marginTop:2}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:'24px 28px',marginBottom:14,display:'flex',alignItems:'center',gap:22}}>
                  <div style={{width:80,height:104,borderRadius:12,flexShrink:0,background:'linear-gradient(145deg,#6747B2,#8b6dd4)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,boxShadow:'0 8px 24px rgba(103,71,178,.3)'}}>
                    <span style={{fontSize:10,fontWeight:900,color:'#fff'}}>رَوْنَق</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:17,fontWeight:900,letterSpacing:-0.4,marginBottom:4,color:T1}}>{item.product_name??'كتاب رَوْنَق — دليل التنظيف الاحترافي'}</div>
                    <div style={{fontSize:12,color:T3,marginBottom:10}}>الإصدار {item.product_version??'1.0'} · PDF</div>
                    <div style={{marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:T3,marginBottom:5}}>
                        <span>التحميلات المستخدمة</span>
                        <span style={{fontWeight:700,color:dlLeft>0?T2:'#A32D2D'}}>{dlUsed} / {dlLimit}</span>
                      </div>
                      <div style={{height:5,background:BR,borderRadius:999,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${dlPct}%`,background:dlLeft>2?P:dlLeft>0?'#FCB932':'#E24B4A',borderRadius:999,transition:'width .4s'}}/>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                      {['PDF',dlLeft>0?'تحميل متاح':'نفذت التحميلات','تحديث'].map((tag,i)=>(
                        <span key={i} style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:999,background:i===0?PL:i===1?(dlLeft>0?'#E1F5EE':'#FEF2F2'):'#FAEEDA',color:i===0?P:i===1?(dlLeft>0?'#085041':'#A32D2D'):'#633806'}}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:140}}>
                    <button onClick={()=>handleDownload(item)} disabled={st==='loading'||dlLeft<=0} style={{height:42,background:dlLeft<=0?'#C8C0D8':st==='loading'?'#8b6dd4':P,color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:900,cursor:dlLeft<=0||st==='loading'?'not-allowed':'pointer',fontFamily:"'Th',serif",transition:'all .2s'}}>
                      {st==='loading'?'...':dlLeft<=0?'نفذت':'⬇ تحميل'}
                    </button>
                    <Link href="/account" style={{height:38,background:'#fff',border:`1px solid ${BR}`,borderRadius:10,fontSize:12,fontWeight:700,color:T2,display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none'}}>حسابي</Link>
                  </div>
                </div>
                <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:24,marginBottom:20}}>
                  <div style={{fontSize:14,fontWeight:900,color:T1,marginBottom:3}}>محتوى الكتاب</div>
                  <div style={{fontSize:12,color:T3,marginBottom:16}}>5 فصول · قوائم وجداول جاهزة</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {CHAPTERS.map(ch=>(
                      <div key={ch.n} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'#FAFAFA',border:`1px solid ${BR}`}}>
                        <div style={{width:28,height:28,borderRadius:8,background:P,color:'#fff',fontSize:12,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ch.n}</div>
                        <span style={{fontSize:13,flex:1,color:T1}}>{ch.title}</span>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:999,background:ch.status==='done'?'#E1F5EE':PL,color:ch.status==='done'?'#085041':P}}>{ch.status==='done'?'متاح':'تحديث'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}
