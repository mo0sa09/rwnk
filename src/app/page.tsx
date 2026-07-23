import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import {
  IconShieldCheck, IconBolt, IconStarFilled, IconX, IconRefresh,
  IconMoodSad, IconClockOff, IconCheck, IconCircleCheck,
  IconBook2, IconCalendar, IconPhoto, IconLayoutGrid,
} from '@tabler/icons-react'
import { getStoreSettings, splitHighlight } from '@/lib/store-settings'
import { getTestimonials, getFaqs, getFeatures, getComparisonRows } from '@/lib/content'

const P='#6747B2',PL='#EDE8FF',PT='#26215C',T1='#1A1228',T2='#4A4060',T3='#9890AA',BR='#EDE8F5'

export const metadata: Metadata = {
  title: 'رَوْنَق — دليل التنظيف الاحترافي',
  description: 'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف بمعايير الفنادق الخمس نجوم. تحميل فوري، ضمان 7 أيام.',
  openGraph: {
    title: 'رَوْنَق — دليل التنظيف الاحترافي',
    description: 'دليل تدريبي يحوّل عاملتك إلى خبيرة تنظيف بمعايير 5 نجوم',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'رَوْنَق — دليل التنظيف الاحترافي',
    description: 'دليل تدريبي يحوّل عاملتك إلى خبيرة تنظيف بمعايير 5 نجوم',
  },
}

const ICON_MAP: Record<string, typeof IconStarFilled> = {
  IconStarFilled, IconCheck, IconCalendar, IconPhoto, IconBook2,
  IconShieldCheck, IconBolt, IconCircleCheck, IconLayoutGrid,
}

export default async function HomePage() {
  const [settings, testimonials, faqs, features, comparisonRows] = await Promise.all([
    getStoreSettings(), getTestimonials(), getFaqs(), getFeatures(), getComparisonRows(),
  ])

  const hero = splitHighlight(settings.hero_title)

  return (
    <div style={{fontFamily:"'Th','Noto Kufi Arabic',serif",direction:'rtl',background:'#fff',color:T1}}>
      <Navbar />

      {/* ── HERO ── */}
      <section className="grid-2 hero-grid" style={{maxWidth:900,margin:'0 auto',padding:'clamp(96px,20vw,120px) clamp(20px,6vw,40px) clamp(56px,10vw,80px)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:56,alignItems:'center',minHeight:'90vh'}}>
        <div style={{minWidth:0}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:PL,color:PT,fontSize:12,fontWeight:700,padding:'5px 14px',borderRadius:999,border:`0.5px solid ${BR}`,marginBottom:22}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#36DB9C'}} />
            {settings.hero_badge}
          </div>
          <h1 style={{fontSize:'clamp(28px,7vw,46px)',fontWeight:900,lineHeight:1.15,letterSpacing:-1.5,marginBottom:18,color:T1}}>
            {hero.pre}{hero.highlight && <span style={{color:P}}>{hero.highlight}</span>}{hero.post}
          </h1>
          <p style={{fontSize:16,color:T2,lineHeight:1.75,marginBottom:30,maxWidth:400}}>
            {settings.hero_subtitle}
          </p>
          <Link href="/checkout" style={{background:P,color:'#fff',display:'inline-flex',alignItems:'center',gap:8,maxWidth:'100%',fontSize:'clamp(14px,3vw,17px)',fontWeight:900,padding:'16px clamp(18px,5vw,30px)',borderRadius:16,textDecoration:'none',boxShadow:'0 4px 20px rgba(103,71,178,.35)',letterSpacing:-0.3}}>
            {settings.hero_cta_text} — {settings.product_price} د.ك
          </Link>
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:T3,marginTop:8}}>
            <IconLockLine /> تحميل فوري · دفع آمن · ضمان 7 أيام
          </div>
          <div style={{display:'flex',gap:10,marginTop:22,flexWrap:'wrap'}}>
            {['+500 نسخة مُباعة','4.9 تقييم','موثوق من شركات التنظيف'].map((t,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:700,color:T2,background:'#fff',border:`0.5px solid ${BR}`,padding:'5px 12px',borderRadius:999}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:'#36DB9C'}} />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
          {settings.product_image_url ? (
            <div style={{width:'clamp(180px,55vw,240px)',height:'clamp(240px,73vw,320px)',borderRadius:20,boxShadow:'0 40px 80px rgba(103,71,178,.35)',position:'relative',overflow:'hidden'}}>
              <Image src={settings.product_image_url} alt={settings.product_name} fill style={{objectFit:'cover'}} />
            </div>
          ) : (
            <div style={{width:'clamp(180px,55vw,240px)',height:'clamp(240px,73vw,320px)',borderRadius:20,background:'linear-gradient(145deg,#6747B2 0%,#9b7fe0 50%,#6239b0 100%)',boxShadow:'0 40px 80px rgba(103,71,178,.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:12,left:12,background:'#FCB932',color:'#412402',fontSize:10,fontWeight:900,padding:'3px 9px',borderRadius:999}}>PDF</div>
              <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 50%)',pointerEvents:'none'}} />
              <IconBook2 size={48} color="rgba(255,255,255,0.9)" />
              <div style={{color:'#fff',fontSize:22,fontWeight:900,letterSpacing:-0.5}}>رَوْنَق</div>
              <div style={{color:'rgba(255,255,255,0.6)',fontSize:11}}>دليل التنظيف الاحترافي</div>
            </div>
          )}
        </div>
      </section>

      {/* ── STATS ── (hidden by default — toggle in Admin ▸ Content) */}
      {settings.stats_visible && (
        <div id="features" style={{background:'#fff',borderTop:`1px solid ${BR}`,borderBottom:`1px solid ${BR}`,padding:'clamp(20px,5vw,28px) clamp(16px,5vw,40px)'}}>
          <div style={{maxWidth:900,margin:'0 auto',display:'flex',flexWrap:'wrap',justifyContent:'center',rowGap:16}}>
            {settings.stats.map((s,i)=>(
              <div key={i} style={{flex:'1 1 90px',minWidth:90,textAlign:'center',padding:'0 clamp(10px,3vw,28px)',borderLeft:i<settings.stats.length-1?`0.5px solid ${BR}`:'none'}}>
                <div style={{fontSize:'clamp(22px,5vw,32px)',fontWeight:900,color:P,letterSpacing:-1,lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:12,color:T2,marginTop:5}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROBLEM ── */}
      <div style={{background:'#fff',borderBottom:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'clamp(48px,9vw,72px) clamp(20px,6vw,40px)'}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>المشكلة</div>
          <h2 style={{fontSize:'clamp(22px,4.5vw,30px)',fontWeight:900,letterSpacing:-0.8,marginBottom:8}}>هل تعاني من هذه المشاكل؟</h2>
          <p style={{fontSize:15,color:T2,marginBottom:32}}>أغلب أصحاب المنازل يواجهون نفس التحديات كل أسبوع.</p>
          <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[
              {Icon:IconX,       title:'تنظيف بلا معيار',    desc:'المنزل يبدو نظيفاً لكن التفاصيل الدقيقة مهملة دائماً'},
              {Icon:IconRefresh, title:'شرح لا ينتهي',        desc:'تشرح نفس التعليمات كل أسبوع من جديد دون فائدة'},
              {Icon:IconMoodSad, title:'نتائج غير متسقة',      desc:'أحياناً ممتاز، أحياناً مقبول — بدون سبب واضح'},
              {Icon:IconClockOff,title:'وقت ضائع',             desc:'تقضين وقتك في المتابعة اليومية بدل الراحة'},
            ].map(({Icon,title,desc},i)=>(
              <div key={i} style={{background:'#FAFAFA',border:`0.5px solid ${BR}`,borderRadius:16,padding:22,display:'flex',gap:14,alignItems:'flex-start'}}>
                <div style={{width:38,height:38,minWidth:38,borderRadius:10,background:'#FEF2F2',border:'0.5px solid #FECACA',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon size={18} color="#E24B4A" />
                </div>
                <div>
                  <div style={{fontSize:14,fontWeight:900,marginBottom:4}}>{title}</div>
                  <div style={{fontSize:13,color:T2,lineHeight:1.6}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:P,color:'#fff',textAlign:'center',padding:18,fontSize:15,fontWeight:900,borderRadius:16,marginTop:20}}>
            المشكلة ليست في العاملة — المشكلة في غياب النظام
          </div>
        </div>
      </div>

      {/* ── SOLUTION ── */}
      <div id="features" style={{maxWidth:900,margin:'0 auto',padding:'clamp(48px,9vw,72px) clamp(20px,6vw,40px)'}}>
        <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>الحل</div>
        <h2 style={{fontSize:'clamp(22px,4.5vw,30px)',fontWeight:900,letterSpacing:-0.8,marginBottom:8}}>رَوْنَق — النظام الذي كنتِ تبحثين عنه</h2>
        <p style={{fontSize:15,color:T2,marginBottom:32}}>دليل تدريبي رقمي مبني على معايير الفنادق الفاخرة.</p>
        <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {features.map((f)=>{
            const Icon = ICON_MAP[f.icon] ?? IconCircleCheck
            return (
              <div key={f.id} style={{background:'#fff',border:`0.5px solid ${BR}`,borderRadius:16,padding:24}}>
                <div style={{width:42,height:42,borderRadius:12,background:PL,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
                  <Icon size={20} color={P} />
                </div>
                <div style={{fontSize:15,fontWeight:900,marginBottom:5}}>{f.title}</div>
                <div style={{fontSize:13,color:T2,lineHeight:1.6}}>{f.description}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── STEPS ── */}
      <div id="steps" style={{background:'#FAFAFA',borderTop:`1px solid ${BR}`,borderBottom:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'clamp(48px,9vw,72px) clamp(20px,6vw,40px)'}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>كيف تعمل</div>
          <h2 style={{fontSize:'clamp(22px,4.5vw,30px)',fontWeight:900,letterSpacing:-0.8,marginBottom:36}}>3 خطوات وتنتهي</h2>
          <div className="grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
            {[
              {n:'١',title:'اشترِ الدليل',desc:'ادفع مرة واحدة وحمّلي الكتاب فوراً على جهازك'},
              {n:'٢',title:'سلّميه للعاملة',desc:'اطبعيه أو أرسليه — هي ستفهم كل شيء بنفسها'},
              {n:'٣',title:'استمتعي بالنتيجة',desc:'منزل بمستوى الفنادق في أول أسبوع'},
            ].map((s,i)=>(
              <div key={i} style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,padding:28,textAlign:'center'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:PL,color:P,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:900,margin:'0 auto 16px',border:`1px solid ${BR}`}}>{s.n}</div>
                <div style={{fontSize:15,fontWeight:900,marginBottom:8}}>{s.title}</div>
                <div style={{fontSize:13,color:T3,lineHeight:1.6}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TESTIMONIALS ── (hidden by default — toggle in Admin ▸ Content) */}
      {settings.testimonials_visible && (
        <div style={{background:'#fff',borderBottom:`1px solid ${BR}`}}>
          <div style={{maxWidth:900,margin:'0 auto',padding:'clamp(48px,9vw,72px) clamp(20px,6vw,40px)'}}>
            <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>الشهادات</div>
            <h2 style={{fontSize:'clamp(22px,4.5vw,30px)',fontWeight:900,letterSpacing:-0.8,marginBottom:32}}>ماذا قال من جرّب رَوْنَق؟</h2>
            <div className="grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
              {testimonials.map((t)=>(
                <div key={t.id} style={{background:'#fff',border:`0.5px solid ${BR}`,borderRadius:16,padding:22}}>
                  <div style={{display:'flex',gap:2,marginBottom:10}}>
                    {Array.from({length:5}).map((_,si)=>(
                      <IconStarFilled key={si} size={13} color={si<t.rating?'#FCB932':'#EDE8F5'} />
                    ))}
                  </div>
                  <p style={{fontSize:13,color:T2,lineHeight:1.75,marginBottom:14,fontStyle:'italic'}}>&ldquo;{t.review_text}&rdquo;</p>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {t.image_url ? (
                      <Image src={t.image_url} alt={t.name} width={32} height={32} style={{borderRadius:'50%',objectFit:'cover'}} />
                    ) : (
                      <div style={{width:32,height:32,borderRadius:'50%',background:PL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:PT}}>{t.name[0]}</div>
                    )}
                    <div>
                      <div style={{fontSize:13,fontWeight:900}}>{t.name}</div>
                      {t.location && <div style={{fontSize:11,color:T3}}>{t.location}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── COMPARE ── */}
      <div id="compare" style={{background:'#FAFAFA',borderBottom:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'clamp(48px,9vw,72px) clamp(20px,6vw,40px)'}}>
          <h2 style={{fontSize:'clamp(22px,4.5vw,30px)',fontWeight:900,letterSpacing:-0.8,marginBottom:36}}>لماذا رَوْنَق وليس غيره؟</h2>
          <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',background:'#FAFAFA',borderBottom:`1px solid ${BR}`}}>
              <div style={{padding:'14px clamp(12px,4vw,24px)',fontSize:12,fontWeight:900,color:T3}}>الميزة</div>
              <div style={{padding:'14px 0',fontSize:12,fontWeight:900,color:P,textAlign:'center'}}>رَوْنَق</div>
              <div style={{padding:'14px 0',fontSize:12,fontWeight:900,color:T3,textAlign:'center'}}>البدائل</div>
            </div>
            {comparisonRows.map((row,i)=>(
              <div key={row.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',borderBottom:i<comparisonRows.length-1?`1px solid ${BR}`:'none'}}>
                <div style={{padding:'14px clamp(12px,4vw,24px)',fontSize:'clamp(12px,3vw,14px)',color:T1}}>{row.label}</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {row.rwnk_has ? <IconCheck size={18} color="#085041" /> : <IconX size={16} color="#C8C0D8" />}
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {row.others_has ? <IconCheck size={18} color="#085041" /> : <IconX size={16} color="#C8C0D8" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" style={{maxWidth:900,margin:'0 auto',padding:'clamp(48px,9vw,72px) clamp(20px,6vw,40px)',textAlign:'center'}}>
        <h2 style={{fontSize:'clamp(22px,4.5vw,30px)',fontWeight:900,letterSpacing:-0.8,marginBottom:6}}>استثمار واحد — نتائج مدى الحياة</h2>
        <p style={{fontSize:15,color:T2,marginBottom:36}}>سعر أقل من جلسة تنظيف احترافية واحدة</p>
        <div style={{maxWidth:380,margin:'0 auto',background:'#fff',border:`2px solid ${P}`,borderRadius:24,padding:'clamp(28px,7vw,36px) clamp(22px,6vw,32px)',position:'relative'}}>
          <div style={{position:'absolute',top:18,left:18,background:P,color:'#fff',fontSize:11,fontWeight:900,padding:'4px 14px',borderRadius:999}}>الأكثر قيمة</div>
          <div style={{fontSize:14,color:T3,textDecoration:'line-through',marginBottom:4}}>25 دينار</div>
          <div style={{fontSize:'clamp(38px,10vw,52px)',fontWeight:900,color:P,letterSpacing:-2,lineHeight:1,marginBottom:4}}>
            {settings.product_price} <span style={{fontSize:18,fontWeight:400,color:T3}}>دينار كويتي</span>
          </div>
          <div style={{fontSize:13,color:T3,marginBottom:24}}>دفعة واحدة · بدون اشتراك شهري</div>
          {['الكتاب الرقمي كامل (PDF)','قوائم التفتيش للطباعة','الجداول اليومية والأسبوعية','تحديثات مجانية مدى الحياة','تحميل فوري بعد الدفع'].map((f,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,marginBottom:10,textAlign:'right'}}>
              <IconCircleCheck size={18} color="#085041" style={{flexShrink:0}} />{f}
            </div>
          ))}
          <Link href="/checkout" style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',minHeight:52,height:'auto',padding:'14px 12px',background:P,color:'#fff',borderRadius:12,fontSize:15,fontWeight:900,textDecoration:'none',marginTop:8,boxShadow:'0 2px 12px rgba(103,71,178,.28)',textAlign:'center'}}>
            {settings.pricing_cta_text}
          </Link>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div id="faq" style={{background:'#FAFAFA',borderTop:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'clamp(48px,9vw,72px) clamp(20px,6vw,40px)'}}>
          <h2 style={{fontSize:'clamp(22px,4.5vw,30px)',fontWeight:900,letterSpacing:-0.8,marginBottom:32}}>أسئلة شائعة</h2>
          <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:640}}>
            {faqs.slice(0,4).map((faq)=>(
              <div key={faq.id} style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:14,padding:'16px 20px'}}>
                <div style={{fontSize:14,fontWeight:900,color:T1,marginBottom:8}}>{faq.question}</div>
                <div style={{fontSize:13,color:T2,lineHeight:1.65}}>{faq.answer}</div>
              </div>
            ))}
          </div>
          <div style={{maxWidth:640,marginTop:20}}>
            <Link href="/faq" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:14,fontWeight:900,color:P,textDecoration:'none',background:'#fff',border:`1px solid ${BR}`,padding:'12px 22px',borderRadius:12}}>
              عرض المزيد من الأسئلة ←
            </Link>
          </div>
        </div>
      </div>

      {/* ── GUARANTEE ── */}
      <div id="guarantee" style={{maxWidth:900,margin:'0 auto',padding:'clamp(40px,8vw,64px) clamp(20px,6vw,40px)',textAlign:'center'}}>
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'center',gap:18,maxWidth:440,margin:'0 auto',background:'#E1F5EE',border:'1px solid #5DCAA5',borderRadius:20,padding:'24px 28px'}}>
          <IconShieldCheck size={36} color="#085041" style={{flexShrink:0}} />
          <div style={{textAlign:'right',minWidth:0}}>
            <div style={{fontSize:16,fontWeight:900,color:'#04342C',marginBottom:4}}>ضمان الاسترجاع الكامل خلال 7 أيام</div>
            <div style={{fontSize:13,color:'#085041'}}>إذا لم تكوني راضية، نُعيد لك المبلغ بالكامل دون أي أسئلة.</div>
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <section style={{background:P,padding:'clamp(56px,10vw,80px) clamp(20px,6vw,40px)',textAlign:'center'}}>
        <h2 style={{fontSize:'clamp(24px,5vw,34px)',fontWeight:900,color:'#fff',letterSpacing:-0.8,marginBottom:10}}>{settings.final_cta_title}</h2>
        <p style={{fontSize:16,color:'rgba(255,255,255,0.8)',marginBottom:32}}>{settings.final_cta_subtitle}</p>
        <Link href="/checkout" style={{background:'#fff',color:P,display:'inline-block',maxWidth:'100%',fontSize:'clamp(14px,3.5vw,18px)',fontWeight:900,padding:'16px clamp(20px,6vw,40px)',borderRadius:16,textDecoration:'none',letterSpacing:-0.3}}>
          {settings.final_cta_button_text} — {settings.product_price} د.ك
        </Link>
        <div style={{display:'flex',gap:24,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
          {[
            {Icon:IconBolt,       text:'تحميل فوري'},
            {Icon:IconShieldCheck,text:'دفع آمن'},
            {Icon:IconCircleCheck,text:'ضمان 7 أيام'},
          ].map(({Icon,text})=>(
            <span key={text} style={{fontSize:13,color:'rgba(255,255,255,0.75)',display:'flex',alignItems:'center',gap:6}}>
              <Icon size={14} color="rgba(255,255,255,0.75)" />{text}
            </span>
          ))}
        </div>
      </section>

      <Footer settings={settings} />
    </div>
  )
}

// Simple inline lock icon for the hero
function IconLockLine() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
