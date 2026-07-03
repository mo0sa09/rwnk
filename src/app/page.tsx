'use client'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import {
  IconShieldCheck, IconBolt, IconStarFilled, IconX, IconRefresh,
  IconMoodSad, IconClockOff, IconCheck, IconCircleCheck,
  IconBook2, IconCalendar, IconPhoto, IconLayoutGrid,
} from '@tabler/icons-react'

const P='#6747B2',PL='#EDE8FF',PT='#26215C',T1='#1A1228',T2='#4A4060',T3='#9890AA',BR='#EDE8F5'

export default function HomePage() {
  return (
    <div style={{fontFamily:"'Th','Noto Kufi Arabic',serif",direction:'rtl',background:'#fff',color:T1}}>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{maxWidth:900,margin:'0 auto',padding:'120px 40px 80px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:56,alignItems:'center',minHeight:'90vh'}}>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:PL,color:PT,fontSize:12,fontWeight:700,padding:'5px 14px',borderRadius:999,border:`0.5px solid ${BR}`,marginBottom:22}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#36DB9C'}} />
            الإصدار الأول — متاح الآن
          </div>
          <h1 style={{fontSize:46,fontWeight:900,lineHeight:1.15,letterSpacing:-1.5,marginBottom:18,color:T1}}>
            منزلك يستحق<br/><span style={{color:P}}>مستوى</span><br/>الفنادق الراقية
          </h1>
          <p style={{fontSize:16,color:T2,lineHeight:1.75,marginBottom:30,maxWidth:400}}>
            دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف — بمعايير خمس نجوم.
          </p>
          <Link href="/checkout" style={{background:P,color:'#fff',display:'inline-flex',alignItems:'center',gap:8,fontSize:17,fontWeight:900,padding:'17px 30px',borderRadius:16,textDecoration:'none',boxShadow:'0 4px 20px rgba(103,71,178,.35)',letterSpacing:-0.3}}>
            احصلي عليه الآن — 15 د.ك
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
          <div style={{width:240,height:320,borderRadius:20,background:'linear-gradient(145deg,#6747B2 0%,#9b7fe0 50%,#6239b0 100%)',boxShadow:'0 40px 80px rgba(103,71,178,.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:12,left:12,background:'#FCB932',color:'#412402',fontSize:10,fontWeight:900,padding:'3px 9px',borderRadius:999}}>PDF</div>
            <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 50%)',pointerEvents:'none'}} />
            <IconBook2 size={48} color="rgba(255,255,255,0.9)" />
            <div style={{color:'#fff',fontSize:22,fontWeight:900,letterSpacing:-0.5}}>رَوْنَق</div>
            <div style={{color:'rgba(255,255,255,0.6)',fontSize:11}}>دليل التنظيف الاحترافي</div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div id="features" style={{background:'#fff',borderTop:`1px solid ${BR}`,borderBottom:`1px solid ${BR}`,padding:'28px 40px'}}>
        <div style={{maxWidth:900,margin:'0 auto',display:'flex',justifyContent:'center'}}>
          {[{n:'+500',l:'نسخة مُباعة'},{n:'4.9',l:'متوسط التقييم'},{n:'7 أيام',l:'ضمان استرجاع'},{n:'5',l:'نجوم معيار'}].map((s,i)=>(
            <div key={i} style={{flex:1,textAlign:'center',padding:'0 28px',borderLeft:i<3?`0.5px solid ${BR}`:'none'}}>
              <div style={{fontSize:32,fontWeight:900,color:P,letterSpacing:-1,lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:12,color:T2,marginTop:5}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEM ── */}
      <div style={{background:'#fff',borderBottom:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'72px 40px'}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>المشكلة</div>
          <h2 style={{fontSize:30,fontWeight:900,letterSpacing:-0.8,marginBottom:8}}>هل تعاني من هذه المشاكل؟</h2>
          <p style={{fontSize:15,color:T2,marginBottom:32}}>أغلب أصحاب المنازل يواجهون نفس التحديات كل أسبوع.</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
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
      <div style={{maxWidth:900,margin:'0 auto',padding:'72px 40px'}}>
        <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>الحل</div>
        <h2 style={{fontSize:30,fontWeight:900,letterSpacing:-0.8,marginBottom:8}}>رَوْنَق — النظام الذي كنتِ تبحثين عنه</h2>
        <p style={{fontSize:15,color:T2,marginBottom:32}}>دليل تدريبي رقمي مبني على معايير الفنادق الفاخرة.</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {[
            {Icon:IconStarFilled, title:'معايير 5 نجوم',       desc:'أسس التنظيف المستوحاة من الفنادق الراقية مُطبَّقة على بيئة المنزل'},
            {Icon:IconCheck,      title:'قوائم تفتيش جاهزة',  desc:'لكل غرفة قائمة منفصلة — لا شيء يُنسى، لا شيء يُهمل'},
            {Icon:IconCalendar,   title:'جداول منظمة',         desc:'يومية · أسبوعية · شهرية — جاهزة للطباعة والتطبيق فوراً'},
            {Icon:IconPhoto,      title:'تعليمات مصورة',        desc:'خطوات بالصور سهلة الفهم والتطبيق لأي عاملة'},
          ].map(({Icon,title,desc},i)=>(
            <div key={i} style={{background:'#fff',border:`0.5px solid ${BR}`,borderRadius:16,padding:24}}>
              <div style={{width:42,height:42,borderRadius:12,background:PL,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
                <Icon size={20} color={P} />
              </div>
              <div style={{fontSize:15,fontWeight:900,marginBottom:5}}>{title}</div>
              <div style={{fontSize:13,color:T2,lineHeight:1.6}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── STEPS ── */}
      <div id="steps" style={{background:'#FAFAFA',borderTop:`1px solid ${BR}`,borderBottom:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'72px 40px'}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>كيف تعمل</div>
          <h2 style={{fontSize:30,fontWeight:900,letterSpacing:-0.8,marginBottom:36}}>3 خطوات وتنتهي</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
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

      {/* ── TESTIMONIALS ── */}
      <div style={{background:'#fff',borderBottom:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'72px 40px'}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>الشهادات</div>
          <h2 style={{fontSize:30,fontWeight:900,letterSpacing:-0.8,marginBottom:32}}>ماذا قال من جرّب رَوْنَق؟</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            {[
              {q:'"اشتريت الكتاب وأعطيته للعاملة. الأسبوع الأول كان فرقاً واضحاً."',name:'أم ماجد',loc:'الكويت',stars:5},
              {q:'"استخدمناه في تدريب موظفاتنا. وفّر وقت التدريب ورفع مستوى الخدمة."',name:'نورة العنزي',loc:'الرياض',stars:5},
              {q:'"القوائم الجاهزة للطباعة هي الأفضل — علّقتها في المطبخ والحمام."',name:'سارة الدوسري',loc:'البحرين',stars:4},
            ].map((t,i)=>(
              <div key={i} style={{background:'#fff',border:`0.5px solid ${BR}`,borderRadius:16,padding:22}}>
                <div style={{display:'flex',gap:2,marginBottom:10}}>
                  {Array.from({length:5}).map((_,si)=>(
                    <IconStarFilled key={si} size={13} color={si<t.stars?'#FCB932':'#EDE8F5'} />
                  ))}
                </div>
                <p style={{fontSize:13,color:T2,lineHeight:1.75,marginBottom:14,fontStyle:'italic'}}>{t.q}</p>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:PL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:PT}}>{t.name[0]}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:900}}>{t.name}</div>
                    <div style={{fontSize:11,color:T3}}>{t.loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── COMPARE ── */}
      <div id="compare" style={{background:'#FAFAFA',borderBottom:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'72px 40px'}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>مقارنة بالسوق</div>
          <h2 style={{fontSize:30,fontWeight:900,letterSpacing:-0.8,marginBottom:36}}>لماذا رَوْنَق وليس غيره؟</h2>
          <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:20,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',background:'#FAFAFA',borderBottom:`1px solid ${BR}`}}>
              <div style={{padding:'14px 24px',fontSize:12,fontWeight:900,color:T3}}>الميزة</div>
              <div style={{padding:'14px 0',fontSize:12,fontWeight:900,color:P,textAlign:'center'}}>رَوْنَق</div>
              <div style={{padding:'14px 0',fontSize:12,fontWeight:900,color:T3,textAlign:'center'}}>البدائل</div>
            </div>
            {['باللغة العربية','مستوى الفنادق','قوائم جاهزة للطباعة','تحديثات مجانية','ضمان استرجاع 7 أيام','دفعة واحدة'].map((f,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',borderBottom:i<5?`1px solid ${BR}`:'none'}}>
                <div style={{padding:'14px 24px',fontSize:14,color:T1}}>{f}</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><IconCheck size={18} color="#085041" /></div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><IconX size={16} color="#C8C0D8" /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" style={{maxWidth:900,margin:'0 auto',padding:'72px 40px',textAlign:'center'}}>
        <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>التسعير</div>
        <h2 style={{fontSize:30,fontWeight:900,letterSpacing:-0.8,marginBottom:6}}>استثمار واحد — نتائج مدى الحياة</h2>
        <p style={{fontSize:15,color:T2,marginBottom:36}}>سعر أقل من جلسة تنظيف احترافية واحدة</p>
        <div style={{maxWidth:380,margin:'0 auto',background:'#fff',border:`2px solid ${P}`,borderRadius:24,padding:'36px 32px',position:'relative'}}>
          <div style={{position:'absolute',top:18,left:18,background:P,color:'#fff',fontSize:11,fontWeight:900,padding:'4px 14px',borderRadius:999}}>الأكثر قيمة</div>
          <div style={{fontSize:14,color:T3,textDecoration:'line-through',marginBottom:4}}>25 دينار</div>
          <div style={{fontSize:52,fontWeight:900,color:P,letterSpacing:-2,lineHeight:1,marginBottom:4}}>
            15 <span style={{fontSize:18,fontWeight:400,color:T3}}>دينار كويتي</span>
          </div>
          <div style={{fontSize:13,color:T3,marginBottom:24}}>دفعة واحدة · بدون اشتراك شهري</div>
          {['الكتاب الرقمي كامل (PDF)','قوائم التفتيش للطباعة','الجداول اليومية والأسبوعية','تحديثات مجانية مدى الحياة','تحميل فوري بعد الدفع'].map((f,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,marginBottom:10,textAlign:'right'}}>
              <IconCircleCheck size={18} color="#085041" />{f}
            </div>
          ))}
          <Link href="/checkout" style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:52,background:P,color:'#fff',borderRadius:12,fontSize:15,fontWeight:900,textDecoration:'none',marginTop:8,boxShadow:'0 2px 12px rgba(103,71,178,.28)'}}>
            اشترِ الآن وحمّلي فوراً
          </Link>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div id="faq" style={{background:'#FAFAFA',borderTop:`1px solid ${BR}`}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'72px 40px'}}>
          <div style={{fontSize:11,fontWeight:900,color:P,textTransform:'uppercase',letterSpacing:2,marginBottom:8}}>الاعتراضات</div>
          <h2 style={{fontSize:30,fontWeight:900,letterSpacing:-0.8,marginBottom:32}}>أسئلة شائعة</h2>
          <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:640}}>
            {[
              {q:'كيف أستلم الكتاب بعد الشراء؟',a:'تحميل فوري — بعد الدفع تصلك رسالة برابط التحميل المباشر.'},
              {q:'هل يمكنني طباعة الكتاب؟',a:'نعم، مصمم للطباعة. القوائم والجداول بتنسيق A4 جاهز.'},
              {q:'هل يناسب كل أنواع المنازل؟',a:'نعم، ليناسب الشقق والفلل بمختلف أحجامها في منطقة الخليج.'},
              {q:'هل هناك تحديثات مستقبلية؟',a:'نعم، جميع التحديثات مجانية لمن اشترى النسخة الأولى.'},
            ].map((faq,i)=>(
              <div key={i} style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:14,padding:'16px 20px'}}>
                <div style={{fontSize:14,fontWeight:900,color:T1,marginBottom:8}}>{faq.q}</div>
                <div style={{fontSize:13,color:T2,lineHeight:1.65}}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GUARANTEE ── */}
      <div id="guarantee" style={{maxWidth:900,margin:'0 auto',padding:'64px 40px',textAlign:'center'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:18,background:'#E1F5EE',border:'1px solid #5DCAA5',borderRadius:20,padding:'24px 32px'}}>
          <IconShieldCheck size={36} color="#085041" />
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:16,fontWeight:900,color:'#04342C',marginBottom:4}}>ضمان الاسترجاع الكامل خلال 7 أيام</div>
            <div style={{fontSize:13,color:'#085041'}}>إذا لم تكوني راضية، نُعيد لك المبلغ بالكامل دون أي أسئلة.</div>
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <section style={{background:P,padding:'80px 40px',textAlign:'center'}}>
        <h2 style={{fontSize:34,fontWeight:900,color:'#fff',letterSpacing:-0.8,marginBottom:10}}>ابدئي رحلتك نحو منزل بمستوى الفنادق اليوم</h2>
        <p style={{fontSize:16,color:'rgba(255,255,255,0.8)',marginBottom:32}}>انضمي إلى +500 عائلة اختارت رَوْنَق نظاماً لمنازلها</p>
        <Link href="/checkout" style={{background:'#fff',color:P,display:'inline-block',fontSize:18,fontWeight:900,padding:'18px 40px',borderRadius:16,textDecoration:'none',letterSpacing:-0.3}}>
          احصلي على رَوْنَق — 15 د.ك
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

      <Footer />
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
