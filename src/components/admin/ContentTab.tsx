'use client'
import { useState, useEffect } from 'react'
import { C } from '@/lib/theme'
import type { StoreSettings, StatItem } from '@/lib/store-settings'

const W = '#fff'
const inp: React.CSSProperties = {
  width: '100%', height: 42, background: '#fafafa', border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '0 12px', fontSize: 13, color: C.text1, outline: 'none', fontFamily: "'Th',serif",
}
const label: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }
const card: React.CSSProperties = { background: W, border: `1px solid ${C.border}`, borderRadius: 18, padding: '22px 24px', marginBottom: 16 }
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 900, color: C.text1, marginBottom: 16 }

export function ContentTab() {
  const [s, setS] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(j => { setS(j.data); setLoading(false) })
  }, [])

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setS(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function setStat(i: number, patch: Partial<StatItem>) {
    setS(prev => {
      if (!prev) return prev
      const stats = [...prev.stats]
      stats[i] = { ...stats[i], ...patch }
      return { ...prev, stats }
    })
  }

  async function save() {
    if (!s) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
      if (!res.ok) throw new Error((await res.json()).error ?? 'حدث خطأ')
      setMsg('✓ تم الحفظ بنجاح')
    } catch (e: any) {
      setMsg(`✗ ${e.message}`)
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  if (loading || !s) return <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>جاري التحميل...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: C.text1, marginBottom: 4 }}>محتوى الصفحة الرئيسية</h1>
        <p style={{ fontSize: 13, color: C.text3 }}>عدّلي نصوص الهيرو، الأزرار، الإحصائيات، والشهادات</p>
      </div>

      <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={cardTitle}>القسم الرئيسي (Hero)</div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>الشارة الصغيرة</label>
            <input style={inp} value={s.hero_badge} onChange={e => set('hero_badge', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>العنوان الرئيسي — أحيطي الكلمة المميزة بـ * لتلوينها</label>
            <input style={inp} value={s.hero_title} onChange={e => set('hero_title', e.target.value)} placeholder="منزلك يستحق *مستوى* الفنادق" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>الوصف الفرعي</label>
            <textarea rows={2} style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} value={s.hero_subtitle} onChange={e => set('hero_subtitle', e.target.value)} />
          </div>
          <div>
            <label style={label}>نص زر الشراء الرئيسي</label>
            <input style={inp} value={s.hero_cta_text} onChange={e => set('hero_cta_text', e.target.value)} />
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>صورة المنتج</div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>رابط صورة المنتج (اختياري — تظهر بدلاً من الغلاف الافتراضي)</label>
            <input style={inp} dir="ltr" value={s.product_image_url ?? ''} onChange={e => set('product_image_url', e.target.value || null)} placeholder="https://..." />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>نص زر صفحة التسعير</label>
            <input style={inp} value={s.pricing_cta_text} onChange={e => set('pricing_cta_text', e.target.value)} />
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>الدعوة الختامية (Final CTA)</div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>العنوان</label>
            <input style={inp} value={s.final_cta_title} onChange={e => set('final_cta_title', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>الوصف</label>
            <input style={inp} value={s.final_cta_subtitle} onChange={e => set('final_cta_subtitle', e.target.value)} />
          </div>
          <div>
            <label style={label}>نص الزر</label>
            <input style={inp} value={s.final_cta_button_text} onChange={e => set('final_cta_button_text', e.target.value)} />
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>شريط الفوتر الترويجي</div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>العنوان</label>
            <input style={inp} value={s.footer_cta_title} onChange={e => set('footer_cta_title', e.target.value)} />
          </div>
          <div>
            <label style={label}>الوصف</label>
            <input style={inp} value={s.footer_cta_subtitle} onChange={e => set('footer_cta_subtitle', e.target.value)} />
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ ...cardTitle, marginBottom: 0 }}>الإحصائيات</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.text2, cursor: 'pointer' }}>
              <input type="checkbox" checked={s.stats_visible} onChange={e => set('stats_visible', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              إظهار القسم في الصفحة الرئيسية
            </label>
          </div>
          {s.stats.map((stat, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input style={inp} value={stat.value} onChange={e => setStat(i, { value: e.target.value })} placeholder="القيمة" />
              <input style={inp} value={stat.label} onChange={e => setStat(i, { label: e.target.value })} placeholder="التسمية" />
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 12 }}>الشهادات</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.text2, cursor: 'pointer' }}>
            <input type="checkbox" checked={s.testimonials_visible} onChange={e => set('testimonials_visible', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            إظهار قسم الشهادات في الصفحة الرئيسية
          </label>
          <p style={{ fontSize: 12, color: C.text3, marginTop: 10 }}>لإضافة أو تعديل الشهادات، انتقلي إلى تبويب &quot;الشهادات&quot;.</p>
        </div>
      </div>

      {msg && <div style={{ margin: '14px 0', padding: '10px 16px', background: msg.startsWith('✓') ? C.secondaryBg : C.errorBg, borderRadius: 10, fontSize: 13, fontWeight: 700, color: msg.startsWith('✓') ? '#085041' : '#A32D2D' }}>{msg}</div>}
      <button onClick={save} disabled={saving} style={{ marginTop: 14, height: 46, padding: '0 28px', background: saving ? '#8b6dd4' : C.primary, color: W, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: saving ? 'wait' : 'pointer', fontFamily: "'Th',serif", boxShadow: '0 2px 12px rgba(103,71,178,.28)' }}>
        {saving ? 'جاري الحفظ...' : 'حفظ المحتوى'}
      </button>
    </div>
  )
}
