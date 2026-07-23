'use client'
import { useState, useEffect } from 'react'
import { C } from '@/lib/theme'
import type { PageContent } from '@/types'

const W = '#fff'
const inp: React.CSSProperties = {
  width: '100%', height: 42, background: '#fafafa', border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '0 12px', fontSize: 13, color: C.text1, outline: 'none', fontFamily: "'Th',serif",
}
const label: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }

const SLUGS: { slug: PageContent['slug']; label: string }[] = [
  { slug: 'about',   label: 'من نحن' },
  { slug: 'terms',   label: 'شروط الاستخدام' },
  { slug: 'privacy', label: 'سياسة الخصوصية' },
  { slug: 'refund',  label: 'سياسة الاسترجاع' },
]

export function PagesTab() {
  const [pages, setPages] = useState<Record<string, PageContent>>({})
  const [active, setActive] = useState<PageContent['slug']>('about')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/pages')
      const json = await res.json()
      const map: Record<string, PageContent> = {}
      for (const p of json.data ?? []) map[p.slug] = p
      setPages(map)
      setLoading(false)
    }
    load()
  }, [])

  const current = pages[active]

  function setField<K extends keyof PageContent>(key: K, value: PageContent[K]) {
    setPages(prev => ({ ...prev, [active]: { ...prev[active], [key]: value } }))
  }

  async function save() {
    if (!current) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/pages/${active}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: current.title, meta_description: current.meta_description, content: current.content }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'حدث خطأ')
      setMsg('✓ تم الحفظ بنجاح')
    } catch (e: any) {
      setMsg(`✗ ${e.message}`)
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: C.text1, marginBottom: 4 }}>الصفحات</h1>
        <p style={{ fontSize: 13, color: C.text3 }}>عدّلي محتوى صفحات من نحن، الشروط، الخصوصية، والاسترجاع</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SLUGS.map(s => (
          <button key={s.slug} onClick={() => setActive(s.slug)} style={{
            height: 36, padding: '0 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Th',serif",
            background: active === s.slug ? C.primary : '#fff', color: active === s.slug ? W : C.text2,
            border: `1px solid ${active === s.slug ? C.primary : C.border}`,
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {loading || !current ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.text3 }}>جاري التحميل...</div>
      ) : (
        <div style={{ background: W, border: `1px solid ${C.border}`, borderRadius: 18, padding: '22px 24px' }}>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>عنوان الصفحة</label>
            <input style={inp} value={current.title} onChange={e => setField('title', e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>وصف SEO (Meta Description)</label>
            <input style={inp} value={current.meta_description ?? ''} onChange={e => setField('meta_description', e.target.value)} />
          </div>
          <div>
            <label style={label}>المحتوى — افصلي بين الفقرات بسطر فارغ</label>
            <textarea rows={12} style={{ ...inp, height: 'auto', padding: '12px', lineHeight: 1.8, resize: 'vertical' }} value={current.content} onChange={e => setField('content', e.target.value)} />
          </div>
        </div>
      )}

      {msg && <div style={{ margin: '14px 0', padding: '10px 16px', background: msg.startsWith('✓') ? C.secondaryBg : C.errorBg, borderRadius: 10, fontSize: 13, fontWeight: 700, color: msg.startsWith('✓') ? '#085041' : '#A32D2D' }}>{msg}</div>}
      <button onClick={save} disabled={saving || loading} style={{ marginTop: 14, height: 46, padding: '0 28px', background: saving ? '#8b6dd4' : C.primary, color: W, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: saving ? 'wait' : 'pointer', fontFamily: "'Th',serif", boxShadow: '0 2px 12px rgba(103,71,178,.28)' }}>
        {saving ? 'جاري الحفظ...' : 'حفظ الصفحة'}
      </button>
    </div>
  )
}
