'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { C, R } from '@/lib/theme'
import {
  IconLayoutDashboard, IconUsers, IconBuildingStore, IconTag,
  IconPalette, IconSettings, IconBell, IconPlus,
  IconCircleCheck, IconAlertCircle, IconCheck,
  IconLayoutGrid, IconQuote, IconHelpCircle, IconStarFilled,
  IconColumns, IconFileText,
} from '@tabler/icons-react'
import { signOut } from '@/lib/auth'
import { CrudSection } from '@/components/admin/CrudSection'
import { ContentTab } from '@/components/admin/ContentTab'
import { PagesTab } from '@/components/admin/PagesTab'

// ── Types ────────────────────────────────────────────────────
interface StoreForm {
  store_name: string; store_tagline: string; product_name: string
  product_price: number; whatsapp: string; email: string
  instagram: string; twitter: string; downloads_limit: number
  product_description: string; product_image_url: string | null
}
interface DiscountCode {
  id: string; code: string; discount_type: 'percent'|'fixed'
  discount_value: number; max_uses: number|null; used_count: number
  expires_at: string|null; is_active: boolean
}
interface Stats { revenue: number; customers: number; downloads: number; purchases: any[] }

type Tab = 'dashboard' | 'customers' | 'theme' | 'store' | 'content' | 'testimonials' | 'faqs' | 'features' | 'comparison' | 'pages' | 'discounts' | 'settings'

// ── Helpers ──────────────────────────────────────────────────
const W = '#fff'
const BG = '#F8F7FF'
const inp: React.CSSProperties = {
  width: '100%', height: 44, background: '#fafafa', border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '0 12px', fontSize: 13, color: C.text1, outline: 'none',
  fontFamily: "'Th',serif", transition: 'all .2s',
}
const focus = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => {
  e.target.style.borderColor = C.primary; e.target.style.boxShadow = '0 0 0 3px rgba(103,71,178,.1)'
}
const blur = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => {
  e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'
}

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard',     label: 'لوحة التحكم',       icon: 'dashboard' },
  { id: 'customers',     label: 'العملاء',            icon: 'customers' },
  { id: 'store',         label: 'إعدادات المتجر',     icon: 'store' },
  { id: 'content',       label: 'المحتوى',            icon: 'content' },
  { id: 'testimonials',  label: 'الشهادات',           icon: 'testimonials' },
  { id: 'faqs',          label: 'الأسئلة الشائعة',   icon: 'faqs' },
  { id: 'features',      label: 'المميزات',           icon: 'features' },
  { id: 'comparison',    label: 'المقارنة',           icon: 'comparison' },
  { id: 'pages',         label: 'الصفحات',            icon: 'pages' },
  { id: 'discounts',     label: 'أكواد الخصم',       icon: 'discounts' },
  { id: 'theme',         label: 'الثيم',              icon: 'theme' },
  { id: 'settings',      label: 'الإعدادات',          icon: 'settings' },
]

const WEEKLY = [3,7,5,9,6,11,8]
const DAYS   = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة']
const MAX_W  = Math.max(...WEEKLY)

const STATUS: Record<string, { bg:string; color:string; label:string }> = {
  completed: { bg: C.secondaryBg, color: '#085041', label: 'مكتمل'       },
  pending:   { bg: C.primaryLight,color: C.primaryText, label: 'قيد التنفيذ' },
  refunded:  { bg: C.errorBg,     color: C.error,   label: 'ملغى'        },
  failed:    { bg: C.errorBg,     color: C.error,   label: 'فشل'         },
}

export default function AdminPage() {
  const [tab, setTab]           = useState<Tab>('dashboard')
  const [stats, setStats]       = useState<Stats>({ revenue:0, customers:0, downloads:0, purchases:[] })
  const [customers, setCustomers] = useState<any[]>([])
  const [discounts, setDiscounts] = useState<DiscountCode[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')

  // Store form
  const [store, setStore] = useState<StoreForm>({
    store_name: 'رَوْنَق', store_tagline: 'دليل التنظيف الاحترافي',
    product_name: 'كتاب رَوْنَق', product_price: 15,
    whatsapp: '+96500000000', email: 'hello@rwnk.co',
    instagram: '@rwnak.official', twitter: '@rwnk', downloads_limit: 5,
    product_description: '', product_image_url: null,
  })

  // Theme
  const [primaryColor, setPrimary] = useState('#6747B2')
  const THEME_PRESETS = [
    { name: 'بنفسجي', color: '#6747B2' },
    { name: 'أزرق',   color: '#025AD6' },
    { name: 'أخضر',   color: '#0a8a5f' },
    { name: 'وردي',   color: '#C2185B' },
    { name: 'برتقالي',color: '#E65100' },
    { name: 'رمادي',  color: '#37474F' },
  ]

  // New discount form
  const [newDisc, setNewDisc] = useState({ code:'', type:'percent', value:'', maxUses:'', expiresAt:'' })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ) as any

      // Purchases/downloads/customers — no anon-readable RLS policy exists for
      // these (by design), so they're fetched through the service-role admin API.
      try {
        const statsRes = await fetch('/api/admin/stats')
        const statsJson = await statsRes.json()
        if (statsRes.ok && statsJson.data) {
          setStats({ revenue: statsJson.data.revenue, customers: statsJson.data.customers, downloads: statsJson.data.downloads, purchases: statsJson.data.purchases })
          setCustomers(statsJson.data.customerList ?? [])
        }
      } catch {}

      // Store settings — public SELECT policy, safe to read with the anon key
      const { data: ss } = await sb.from('store_settings').select('*').single()
      if (ss) setStore({ ...store, ...ss })

      // Discounts — admin-only, goes through the service-role API route
      try {
        const dcRes = await fetch('/api/admin/discounts')
        const dcJson = await dcRes.json()
        setDiscounts(dcJson.data ?? [])
      } catch {}

    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function saveStoreSettings() {
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(store) })
      if (!res.ok) throw new Error((await res.json()).error ?? 'حدث خطأ')
      setMsg('✓ تم الحفظ بنجاح')
    } catch { setMsg('✗ حدث خطأ في الحفظ') }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function addDiscount() {
    if (!newDisc.code || !newDisc.value) return
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newDisc.code.toUpperCase(),
          discount_type: newDisc.type,
          discount_value: parseFloat(newDisc.value),
          max_uses: newDisc.maxUses ? parseInt(newDisc.maxUses) : null,
          expires_at: newDisc.expiresAt || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'حدث خطأ')
      setNewDisc({ code:'', type:'percent', value:'', maxUses:'', expiresAt:'' })
      loadData()
    } catch (e: any) { alert(e.message) }
  }

  async function toggleDiscount(id: string, current: boolean) {
    await fetch(`/api/admin/discounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) })
    loadData()
  }

  async function deleteDiscount(id: string) {
    if (!confirm('حذف هذا الكود؟')) return
    await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' })
    loadData()
  }

  const SIDEBAR_W = 210

  return (
    <div className="admin-shell" style={{ display:'flex', minHeight:'100vh', background:BG, direction:'rtl', fontFamily:"'Th','Noto Kufi Arabic',serif" }}>

      {/* ══ SIDEBAR ══ */}
      <aside className="admin-sidebar" style={{ width:SIDEBAR_W, flexShrink:0, background:W, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', position:'fixed', top:0, right:0, bottom:0, zIndex:50 }}>

        <div style={{ padding:'20px 18px 16px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Image src="/logo-icon.png" alt="رَوْنَق" width={28} height={28} style={{ objectFit:'contain' }} />
            <div><div style={{ fontSize:15, fontWeight:900, color:C.text1 }}>رَوْنَق</div><div style={{ fontSize:10, color:C.text3 }}>لوحة التحكم</div></div>
          </div>
        </div>

        <nav className="admin-nav" style={{ flex:1, padding:'10px 10px', overflowY:'auto' }}>
          {NAV.map(item => (
            <button key={item.id} className="admin-nav-btn" onClick={() => setTab(item.id)} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'10px 12px', borderRadius:10, marginBottom:2,
              background: tab === item.id ? C.primary : 'transparent',
              color: tab === item.id ? W : C.text2,
              fontSize:13, fontWeight: tab === item.id ? 700 : 400,
              border:'none', cursor:'pointer', textAlign:'right',
              fontFamily:"'Th',serif", transition:'all .15s',
            }}>
              <span style={{ display:'flex' }}>
              {item.icon === 'dashboard'    && <IconLayoutDashboard size={16} />}
              {item.icon === 'customers'    && <IconUsers size={16} />}
              {item.icon === 'store'        && <IconBuildingStore size={16} />}
              {item.icon === 'content'      && <IconLayoutGrid size={16} />}
              {item.icon === 'testimonials' && <IconQuote size={16} />}
              {item.icon === 'faqs'         && <IconHelpCircle size={16} />}
              {item.icon === 'features'     && <IconStarFilled size={16} />}
              {item.icon === 'comparison'   && <IconColumns size={16} />}
              {item.icon === 'pages'        && <IconFileText size={16} />}
              {item.icon === 'discounts'    && <IconTag size={16} />}
              {item.icon === 'theme'        && <IconPalette size={16} />}
              {item.icon === 'settings'     && <IconSettings size={16} />}
            </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding:'14px 16px', borderTop:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${C.primary},#8b6dd4)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:W, flexShrink:0 }}>م</div>
            <div><div style={{ fontSize:12, fontWeight:700, color:C.text1 }}>المشرف</div><div style={{ fontSize:10, color:C.text3 }}>admin</div></div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <Link href="/" style={{ fontSize:11, color:C.text3, padding:'5px 10px', borderRadius:7, border:`1px solid ${C.border}`, textDecoration:'none' }}>الموقع</Link>
            <button onClick={async()=>{await signOut();window.location.href='/'}} style={{ fontSize:11, color:'#E24B4A', padding:'5px 10px', borderRadius:7, border:'1px solid #FECACA', background:'none', cursor:'pointer', fontFamily:"'Th',serif" }}>خروج</button>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main className="admin-main" style={{ flex:1, marginRight:SIDEBAR_W, padding:'28px 24px 48px' }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontSize:22, fontWeight:900, color:C.text1, letterSpacing:-0.5, marginBottom:4 }}>مرحباً بك، المشرف</h1>
              <p style={{ fontSize:13, color:C.text3 }}>إليك ملخص أداء رَوْنَق لهذا اليوم</p>
            </div>

            {/* Stat cards */}
            <div className="admin-stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:18 }}>
              {[
                { label:'إجمالي الإيرادات', value: loading?'...':`${stats.revenue.toFixed(3)}`, unit:'د.ك', change:'+12%', up:true },
                { label:'إجمالي العملاء',    value: loading?'...':stats.customers.toString(),     unit:'',     change:'+5%',  up:true },
                { label:'إجمالي التحميلات', value: loading?'...':stats.downloads.toString(),    unit:'',     change:'-2%',  up:false },
              ].map((s,i) => (
                <div key={i} style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'20px 22px' }}>
                  <div style={{ fontSize:12, color:C.text3, marginBottom:8 }}>{s.label}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:28, fontWeight:900, color:C.text1, letterSpacing:-1 }}>{s.value}</span>
                    {s.unit && <span style={{ fontSize:13, color:C.text3 }}>{s.unit}</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:s.up?C.secondary:'#E24B4A' }}>{s.up?'↑':'↓'} {s.change}</span>
                    <span style={{ fontSize:11, color:C.text3 }}>من الشهر الماضي</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart + Update card */}
            <div className="admin-chart-grid" style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:14, marginBottom:18 }}>
              <div style={{ background:`linear-gradient(145deg,${C.primary},#8b6dd4)`, borderRadius:18, padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:8 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}><IconCircleCheck size={22} color='rgba(255,255,255,0.8)' /></div>
                <div style={{ fontSize:15, fontWeight:900, color:W }}>كل شيء يعمل</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)', lineHeight:1.5 }}>الموقع يعمل بكفاءة كاملة</div>
                <button onClick={() => setTab('settings')} style={{ marginTop:4, height:33, padding:'0 16px', background:W, color:C.primary, border:'none', borderRadius:8, fontSize:12, fontWeight:900, cursor:'pointer', fontFamily:"'Th',serif" }}>الإعدادات</button>
              </div>
              <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'20px 22px' }}>
                <div style={{ fontSize:14, fontWeight:900, color:C.text1, marginBottom:18 }}>أداء الأسبوع</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:110, paddingBottom:24, position:'relative' }}>
                  {[0.25,0.5,0.75,1].map(f=><div key={f} style={{ position:'absolute', left:0, right:0, bottom:24+f*85, height:1, background:C.border }} />)}
                  {WEEKLY.map((v,i)=>(
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative', zIndex:1 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:C.text3, marginBottom:3 }}>{v}</div>
                      <div style={{ width:'100%', borderRadius:'5px 5px 0 0', height:`${(v/MAX_W)*85}px`, background:`linear-gradient(to top,${C.primary},#a07ee8)`, minHeight:4 }} />
                      <div style={{ position:'absolute', bottom:-18, fontSize:9, color:C.text3, whiteSpace:'nowrap' }}>{DAYS[i]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent orders */}
            <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'20px 22px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:900, color:C.text1 }}>آخر الطلبات</div>
                <button onClick={() => setTab('customers')} style={{ fontSize:12, color:C.primary, fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:"'Th',serif" }}>عرض الكل ←</button>
              </div>
              {loading ? (
                <div style={{ textAlign:'center', padding:'20px', color:C.text3, fontSize:13 }}>جاري التحميل...</div>
              ) : stats.purchases.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px', color:C.text3, fontSize:13 }}>لا توجد طلبات بعد</div>
              ) : (
                <div className="admin-table-wrap">
                  <div className="admin-table-min">
                    <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1.4fr 0.9fr 0.7fr 0.5fr', gap:8, padding:'7px 12px', marginBottom:4 }}>
                      {['المعرّف','العميل','التاريخ','الحالة','المبلغ'].map(h=><div key={h} style={{ fontSize:10, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:0.3 }}>{h}</div>)}
                    </div>
                    {stats.purchases.map((p:any,i:number)=>{
                      const st = STATUS[p.status] ?? STATUS.pending
                      return (
                        <div key={i} style={{ display:'grid', gridTemplateColumns:'1.2fr 1.4fr 0.9fr 0.7fr 0.5fr', gap:8, padding:'11px 12px', borderTop:`1px solid ${C.border}`, alignItems:'center' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.primary }}>{p.invoice_number ?? '—'}</div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:C.text1 }}>{p.email?.split('@')[0] ?? '—'}</div>
                            <div style={{ fontSize:10, color:C.text3 }}>{p.email ?? ''}</div>
                          </div>
                          <div style={{ fontSize:10, color:C.text3 }}>{new Date(p.created_at).toLocaleDateString('ar-KW')}</div>
                          <div><span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999, background:st.bg, color:st.color }}>{st.label}</span></div>
                          <div style={{ fontSize:12, fontWeight:900, color:C.text1 }}>{p.amount} د.ك</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CUSTOMERS ── */}
        {tab === 'customers' && (
          <div>
            <div style={{ marginBottom:24 }}><h1 style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:4 }}>العملاء</h1><p style={{ fontSize:13, color:C.text3 }}>{customers.length} عميل</p></div>
            <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'20px 22px' }}>
              {loading ? <div style={{ textAlign:'center', padding:24, color:C.text3 }}>جاري التحميل...</div>
              : customers.length === 0 ? <div style={{ textAlign:'center', padding:24, color:C.text3 }}>لا يوجد عملاء بعد</div>
              : (
                <div className="admin-table-wrap">
                  <div className="admin-table-min">
                    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 0.8fr', gap:8, padding:'7px 12px', marginBottom:4 }}>
                      {['العميل','طريقة الدفع','تاريخ الشراء','المبلغ'].map(h=><div key={h} style={{ fontSize:10, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:0.3 }}>{h}</div>)}
                    </div>
                    {customers.map((c:any,i:number) => (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 0.8fr', gap:8, padding:'12px 12px', borderTop:`1px solid ${C.border}`, alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:C.primaryLight, color:C.primaryText, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, flexShrink:0 }}>{(c.email??'?')[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{c.email?.split('@')[0]}</div>
                            <div style={{ fontSize:11, color:C.text3 }}>{c.email}</div>
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:C.text2 }}>{c.payment_method ?? 'بطاقة'}</div>
                        <div style={{ fontSize:11, color:C.text3 }}>{new Date(c.created_at).toLocaleDateString('ar-KW')}</div>
                        <div style={{ fontSize:13, fontWeight:900, color:C.primary }}>{c.amount} د.ك</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STORE SETTINGS ── */}
        {tab === 'store' && (
          <div>
            <div style={{ marginBottom:24 }}><h1 style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:4 }}>إعدادات المتجر</h1><p style={{ fontSize:13, color:C.text3 }}>عدّل معلومات المتجر والمنتج</p></div>
            <div className="admin-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              {/* Store info */}
              <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'22px 24px' }}>
                <div style={{ fontSize:13, fontWeight:900, color:C.text1, marginBottom:16 }}>معلومات المتجر</div>
                {[
                  { label:'اسم المتجر',     key:'store_name',    type:'text'   },
                  { label:'الوصف المختصر',  key:'store_tagline', type:'text'   },
                  { label:'البريد الإلكتروني',key:'email',       type:'email'  },
                  { label:'واتساب',          key:'whatsapp',     type:'text'   },
                  { label:'إنستغرام',        key:'instagram',    type:'text'   },
                  { label:'تويتر / X',       key:'twitter',      type:'text'   },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:12 }}>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>{f.label}</label>
                    <input type={f.type} value={(store as any)[f.key]} onFocus={focus} onBlur={blur}
                      onChange={e => setStore(s => ({ ...s, [f.key]: e.target.value }))} style={inp} />
                  </div>
                ))}
              </div>

              {/* Product info */}
              <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'22px 24px' }}>
                <div style={{ fontSize:13, fontWeight:900, color:C.text1, marginBottom:16 }}>معلومات المنتج</div>
                {[
                  { label:'اسم المنتج',  key:'product_name',  type:'text',   input:true },
                  { label:'السعر (د.ك)', key:'product_price', type:'number', input:true },
                  { label:'حد التحميلات للعميل', key:'downloads_limit', type:'number', input:true },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:12 }}>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>{f.label}</label>
                    <input type={f.type} value={(store as any)[f.key]} onFocus={focus} onBlur={blur}
                      onChange={e => setStore(s => ({ ...s, [f.key]: f.type==='number'?parseFloat(e.target.value):e.target.value }))} style={inp} />
                  </div>
                ))}
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>وصف المنتج</label>
                  <textarea rows={3} value={store.product_description} onFocus={focus as any} onBlur={blur as any}
                    onChange={e => setStore(s => ({ ...s, product_description: e.target.value }))} style={{ ...inp, height:'auto', padding:'10px 12px', resize:'vertical' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>رابط صورة المنتج (اختياري)</label>
                  <input type="text" dir="ltr" value={store.product_image_url ?? ''} onFocus={focus} onBlur={blur}
                    onChange={e => setStore(s => ({ ...s, product_image_url: e.target.value || null }))} style={inp} placeholder="https://..." />
                </div>

                {/* Preview */}
                <div style={{ marginTop:20, background:C.surface, borderRadius:12, padding:'14px 16px', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.text3, marginBottom:8 }}>معاينة بطاقة السعر</div>
                  <div style={{ fontSize:11, color:C.text3 }}>{store.product_name}</div>
                  <div style={{ fontSize:28, fontWeight:900, color:C.primary, marginTop:4 }}>{store.product_price} <span style={{ fontSize:14, fontWeight:400, color:C.text3 }}>د.ك</span></div>
                </div>
              </div>
            </div>

            {msg && <div style={{ margin:'14px 0', padding:'10px 16px', background: msg.startsWith('✓')?C.secondaryBg:C.errorBg, borderRadius:10, fontSize:13, fontWeight:700, color: msg.startsWith('✓')?'#085041':'#A32D2D' }}>{msg}</div>}
            <button onClick={saveStoreSettings} disabled={saving} style={{ marginTop:14, height:46, padding:'0 28px', background:saving?'#8b6dd4':C.primary, color:W, border:'none', borderRadius:12, fontSize:14, fontWeight:900, cursor:saving?'wait':'pointer', fontFamily:"'Th',serif", boxShadow:'0 2px 12px rgba(103,71,178,.28)' }}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        )}

        {/* ── CONTENT ── */}
        {tab === 'content' && <ContentTab />}

        {/* ── TESTIMONIALS ── */}
        {tab === 'testimonials' && (
          <CrudSection
            resource="testimonials"
            title="الشهادات"
            description="أضيفي وعدّلي شهادات العملاء — تظهر في الصفحة الرئيسية عند التفعيل من تبويب المحتوى"
            emptyItem={{ name:'', location:'', image_url:'', rating:5, review_text:'', is_active:true }}
            fields={[
              { key:'name', label:'اسم العميلة' },
              { key:'location', label:'الموقع' },
              { key:'image_url', label:'رابط الصورة (اختياري)' },
              { key:'rating', label:'التقييم (1-5)', type:'number' },
              { key:'review_text', label:'نص التقييم', type:'textarea' },
              { key:'is_active', label:'مفعّل', type:'checkbox' },
            ]}
            renderLabel={(t) => t.name}
            renderMeta={(t) => `${t.rating}★ — ${t.review_text}`}
          />
        )}

        {/* ── FAQ ── */}
        {tab === 'faqs' && (
          <CrudSection
            resource="faqs"
            title="الأسئلة الشائعة"
            description="أضيفي وعدّلي ورتّبي الأسئلة الشائعة — تظهر في الصفحة الرئيسية وصفحة /faq"
            reorderable
            emptyItem={{ question:'', answer:'', is_active:true }}
            fields={[
              { key:'question', label:'السؤال' },
              { key:'answer', label:'الإجابة', type:'textarea' },
              { key:'is_active', label:'مفعّل', type:'checkbox' },
            ]}
            renderLabel={(f) => f.question}
            renderMeta={(f) => f.answer}
          />
        )}

        {/* ── FEATURES ── */}
        {tab === 'features' && (
          <CrudSection
            resource="features"
            title="المميزات"
            description="أضيفي وعدّلي شبكة مميزات المنتج في الصفحة الرئيسية"
            emptyItem={{ icon:'IconCircleCheck', title:'', description:'', is_active:true }}
            fields={[
              { key:'title', label:'العنوان' },
              { key:'description', label:'الوصف', type:'textarea' },
              { key:'icon', label:'الأيقونة', type:'select', options:[
                { value:'IconStarFilled', label:'نجمة' },
                { value:'IconCheck', label:'علامة صح' },
                { value:'IconCalendar', label:'تقويم' },
                { value:'IconPhoto', label:'صورة' },
                { value:'IconBook2', label:'كتاب' },
                { value:'IconShieldCheck', label:'درع' },
                { value:'IconBolt', label:'برق' },
                { value:'IconCircleCheck', label:'دائرة صح' },
              ]},
              { key:'is_active', label:'مفعّل', type:'checkbox' },
            ]}
            renderLabel={(f) => f.title}
            renderMeta={(f) => f.description}
          />
        )}

        {/* ── COMPARISON ── */}
        {tab === 'comparison' && (
          <CrudSection
            resource="comparison_rows"
            title="جدول المقارنة"
            description="أضيفي وعدّلي صفوف جدول المقارنة بين رَوْنَق والبدائل"
            emptyItem={{ label:'', rwnk_has:true, others_has:false, is_active:true }}
            fields={[
              { key:'label', label:'الميزة' },
              { key:'rwnk_has', label:'متوفر في رَوْنَق', type:'checkbox' },
              { key:'others_has', label:'متوفر في البدائل', type:'checkbox' },
              { key:'is_active', label:'مفعّل', type:'checkbox' },
            ]}
            renderLabel={(r) => r.label}
            renderMeta={(r) => `رَوْنَق: ${r.rwnk_has?'✓':'✗'} — البدائل: ${r.others_has?'✓':'✗'}`}
          />
        )}

        {/* ── PAGES ── */}
        {tab === 'pages' && <PagesTab />}

        {/* ── DISCOUNT CODES ── */}
        {tab === 'discounts' && (
          <div>
            <div style={{ marginBottom:24 }}><h1 style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:4 }}>أكواد الخصم</h1><p style={{ fontSize:13, color:C.text3 }}>أنشئ وأدر أكواد الخصم</p></div>
            <div className="admin-discounts-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:16 }}>

              {/* New code form */}
              <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'22px 24px' }}>
                <div style={{ fontSize:13, fontWeight:900, color:C.text1, marginBottom:16 }}>كود جديد</div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>الكود</label>
                  <input placeholder="RWNK20" value={newDisc.code} onChange={e=>setNewDisc(d=>({...d,code:e.target.value.toUpperCase()}))} onFocus={focus} onBlur={blur} style={{ ...inp, textTransform:'uppercase' }} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>النوع</label>
                    <select value={newDisc.type} onChange={e=>setNewDisc(d=>({...d,type:e.target.value}))} onFocus={focus as any} onBlur={blur as any} style={{ ...inp, cursor:'pointer' }}>
                      <option value="percent">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت (د.ك)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>القيمة</label>
                    <input type="number" placeholder={newDisc.type==='percent'?'20':'3'} value={newDisc.value} onChange={e=>setNewDisc(d=>({...d,value:e.target.value}))} onFocus={focus} onBlur={blur} style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>أقصى عدد استخدامات (اختياري)</label>
                  <input type="number" placeholder="بدون حد" value={newDisc.maxUses} onChange={e=>setNewDisc(d=>({...d,maxUses:e.target.value}))} onFocus={focus} onBlur={blur} style={inp} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:5 }}>تاريخ الانتهاء (اختياري)</label>
                  <input type="date" value={newDisc.expiresAt} onChange={e=>setNewDisc(d=>({...d,expiresAt:e.target.value}))} onFocus={focus} onBlur={blur} style={inp} />
                </div>
                <button onClick={addDiscount} style={{ width:'100%', height:44, background:C.primary, color:W, border:'none', borderRadius:11, fontSize:14, fontWeight:900, cursor:'pointer', fontFamily:"'Th',serif" }}>
                  إضافة الكود
                </button>
              </div>

              {/* Codes list */}
              <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'22px 24px' }}>
                <div style={{ fontSize:13, fontWeight:900, color:C.text1, marginBottom:16 }}>الأكواد الحالية ({discounts.length})</div>
                {discounts.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'32px', color:C.text3, fontSize:13 }}>لا توجد أكواد بعد</div>
                ) : discounts.map((d) => (
                  <div key={d.id} style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:12, padding:'12px 0', borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ flex:'1 1 160px', minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:900, color:C.text1, fontFamily:'monospace' }}>{d.code}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999, background:d.is_active?C.secondaryBg:C.surface, color:d.is_active?'#085041':C.text3 }}>
                          {d.is_active ? 'فعّال' : 'متوقف'}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:C.text3 }}>
                        {d.discount_type === 'percent' ? `${d.discount_value}% خصم` : `${d.discount_value} د.ك خصم`}
                        {d.max_uses ? ` · ${d.used_count}/${d.max_uses} استخدام` : ` · ${d.used_count} استخدام`}
                        {d.expires_at ? ` · ينتهي ${new Date(d.expires_at).toLocaleDateString('ar-KW')}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                      <button onClick={() => toggleDiscount(d.id, d.is_active)} style={{ height:30, padding:'0 10px', background:d.is_active?C.surface:C.primaryLight, color:d.is_active?C.text3:C.primary, border:`1px solid ${C.border}`, borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'Th',serif" }}>
                        {d.is_active ? 'إيقاف' : 'تفعيل'}
                      </button>
                      <button onClick={() => deleteDiscount(d.id)} style={{ height:30, padding:'0 10px', background:'#FEF2F2', color:'#A32D2D', border:'1px solid #FECACA', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'Th',serif" }}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── THEME ── */}
        {tab === 'theme' && (
          <div>
            <div style={{ marginBottom:24 }}><h1 style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:4 }}>الثيم والألوان</h1><p style={{ fontSize:13, color:C.text3 }}>خصّص هوية الموقع البصرية</p></div>
            <div className="admin-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              {/* Color picker */}
              <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'22px 24px' }}>
                <div style={{ fontSize:13, fontWeight:900, color:C.text1, marginBottom:16 }}>اللون الأساسي</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
                  {THEME_PRESETS.map(preset => (
                    <button key={preset.color} onClick={() => setPrimary(preset.color)} style={{
                      height:52, borderRadius:12, background:preset.color, border:primaryColor===preset.color?`3px solid ${C.text1}`:'3px solid transparent',
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#fff', fontSize:12, fontWeight:700, transition:'all .2s',
                    }}>
                      {primaryColor===preset.color?'✓ ':''}{preset.name}
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:C.text2, textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>لون مخصص</label>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <input type="color" aria-label="لون مخصص" value={primaryColor} onChange={e=>setPrimary(e.target.value)} style={{ width:48, height:44, borderRadius:10, border:`1px solid ${C.border}`, padding:4, cursor:'pointer' }} />
                    <input type="text" value={primaryColor} onChange={e=>setPrimary(e.target.value)} style={{ ...inp, flex:1, fontFamily:'monospace' }} />
                  </div>
                </div>
                <button onClick={async()=>{
                  setSaving(true)
                  const { createClient } = await import('@supabase/supabase-js')
                  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) as any
                  await sb.from('store_settings').upsert({ primary_color: primaryColor } as any)
                  setSaving(false)
                  setMsg('✓ تم حفظ الثيم')
                  setTimeout(()=>setMsg(''),3000)
                }} disabled={saving} style={{ width:'100%', height:44, background:primaryColor, color:W, border:'none', borderRadius:11, fontSize:14, fontWeight:900, cursor:'pointer', fontFamily:"'Th',serif" }}>
                  {saving ? 'جاري الحفظ...' : 'حفظ اللون'}
                </button>
                {msg && <div style={{ marginTop:10, fontSize:12, color:'#085041', fontWeight:700 }}>{msg}</div>}
              </div>

              {/* Live preview */}
              <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'22px 24px' }}>
                <div style={{ fontSize:13, fontWeight:900, color:C.text1, marginBottom:16 }}>معاينة حية</div>
                <div style={{ borderRadius:14, border:`1px solid ${C.border}`, overflow:'hidden' }}>
                  {/* Mini navbar */}
                  <div style={{ background:'rgba(255,255,255,0.95)', borderBottom:`1px solid ${C.border}`, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:13, fontWeight:900, color:C.text1 }}>رَوْنَق</div>
                    <div style={{ background:primaryColor, color:W, fontSize:11, fontWeight:700, padding:'5px 12px', borderRadius:7 }}>اشترِ الآن</div>
                  </div>
                  {/* Mini hero */}
                  <div style={{ padding:'20px 16px', background:C.surface }}>
                    <div style={{ fontSize:16, fontWeight:900, color:C.text1, marginBottom:6 }}>منزلك يستحق <span style={{ color:primaryColor }}>مستوى الفنادق</span></div>
                    <div style={{ fontSize:11, color:C.text3, marginBottom:14 }}>دليل تدريبي احترافي بمعايير خمس نجوم</div>
                    <div style={{ background:primaryColor, color:W, fontSize:12, fontWeight:900, padding:'9px 16px', borderRadius:10, display:'inline-block' }}>احصلي عليه الآن ←</div>
                  </div>
                  {/* Mini badge */}
                  <div style={{ padding:'12px 16px', display:'flex', gap:8 }}>
                    <span style={{ background:`${primaryColor}20`, color:primaryColor, fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999 }}>PDF</span>
                    <span style={{ background:C.secondaryBg, color:'#085041', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999 }}>✓ تحميل متاح</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div>
            <div style={{ marginBottom:24 }}><h1 style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:4 }}>الإعدادات العامة</h1><p style={{ fontSize:13, color:C.text3 }}>إعدادات النظام والبيئة</p></div>
            <div style={{ background:W, border:`1px solid ${C.border}`, borderRadius:18, padding:'22px 24px', marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:900, color:C.text1, marginBottom:16 }}>حالة النظام</div>
              {[
                { label:'Supabase', status: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ متصل' : '✗ غير متصل', ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
                { label:'بوابة الدفع', status: process.env.PAYMENT_GATEWAY ?? 'myfatoorah', ok: true },
                { label:'رابط الموقع', status: process.env.NEXT_PUBLIC_APP_URL ?? 'localhost:3000', ok: true },
              ].map((r,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:i<2?`1px solid ${C.border}`:'none' }}>
                  <span style={{ fontSize:13, color:C.text2 }}>{r.label}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:r.ok?'#085041':'#A32D2D', background:r.ok?C.secondaryBg:C.errorBg, padding:'3px 10px', borderRadius:999 }}>{r.status}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'#FFF5F5', border:'1px solid #FECACA', borderRadius:18, padding:'18px 24px' }}>
              <div style={{ fontSize:13, fontWeight:900, color:'#991B1B', marginBottom:5 }}>منطقة الخطر</div>
              <p style={{ fontSize:12, color:'#B91C1C', marginBottom:14 }}>مسح جميع بيانات الاختبار من قاعدة البيانات.</p>
              <button style={{ height:36, padding:'0 16px', background:'#fff', border:'1px solid #FECACA', borderRadius:9, fontSize:12, fontWeight:700, color:'#991B1B', cursor:'pointer', fontFamily:"'Th',serif" }}>
                مسح بيانات الاختبار
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
