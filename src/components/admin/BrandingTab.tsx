'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { card, cardTitle, inp, label as labelStyle, focus, blur, btnPrimary, LoadingBlock, useToast } from './adminUi'
import { FileUploadField } from './FileUploadField'

const THEME_PRESETS = [
  { name: 'بنفسجي', color: '#6747B2' },
  { name: 'أزرق',   color: '#025AD6' },
  { name: 'أخضر',   color: '#0a8a5f' },
  { name: 'وردي',   color: '#C2185B' },
  { name: 'برتقالي', color: '#E65100' },
  { name: 'رمادي',  color: '#37474F' },
]

interface BrandForm {
  store_name: string; store_tagline: string; whatsapp: string; email: string
  instagram: string; twitter: string; primary_color: string
  logo_url: string | null; favicon_url: string | null
}

export function BrandingTab() {
  const toast = useToast()
  const [form, setForm] = useState<BrandForm>({
    store_name: '', store_tagline: '', whatsapp: '', email: '', instagram: '', twitter: '',
    primary_color: '#6747B2', logo_url: null, favicon_url: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const json = await res.json()
        if (!cancelled && res.ok && json.data) setForm(f => ({ ...f, ...json.data }))
      } catch { toast.push('error', 'تعذّر تحميل إعدادات الهوية') }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [] ) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error((await res.json()).error ?? 'حدث خطأ')
      toast.push('success', 'تم حفظ الهوية البصرية')
    } catch (e: any) { toast.push('error', e.message ?? 'حدث خطأ في الحفظ') }
    setSaving(false)
  }

  if (loading) return <LoadingBlock />

  return (
    <div>
      <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <div style={cardTitle}>الشعار والأيقونة</div>
          <FileUploadField
            label="شعار الموقع (Logo)" kind="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml"
            value={form.logo_url} onChange={url => setForm(f => ({ ...f, logo_url: url }))}
            hint="يظهر في القائمة العلوية والفوتر — الحد الأقصى 2MB"
          />
          <FileUploadField
            label="أيقونة المتصفح (Favicon)" kind="favicon" accept="image/png,image/x-icon,image/svg+xml"
            value={form.favicon_url} onChange={url => setForm(f => ({ ...f, favicon_url: url }))}
            hint="مربعة الشكل يفضّل 512×512 بكسل — الحد الأقصى 1MB"
          />
        </div>

        <div style={card}>
          <div style={cardTitle}>معلومات المتجر</div>
          {[
            { label: 'اسم المتجر', key: 'store_name' as const },
            { label: 'الوصف المختصر', key: 'store_tagline' as const },
            { label: 'البريد الإلكتروني', key: 'email' as const },
            { label: 'واتساب', key: 'whatsapp' as const },
            { label: 'إنستغرام', key: 'instagram' as const },
            { label: 'تويتر / X', key: 'twitter' as const },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{f.label}</label>
              <input value={form[f.key]} onFocus={focus} onBlur={blur} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} style={inp} />
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>اللون الأساسي</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {THEME_PRESETS.map(preset => (
            <button key={preset.color} onClick={() => setForm(f => ({ ...f, primary_color: preset.color }))} style={{
              height: 52, borderRadius: 12, background: preset.color,
              border: form.primary_color === preset.color ? `3px solid ${C.text1}` : '3px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 12, fontWeight: 700, transition: 'all .2s',
            }}>
              {form.primary_color === preset.color ? '✓ ' : ''}{preset.name}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 4 }}>
          <label style={labelStyle}>لون مخصص</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" aria-label="لون مخصص" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} style={{ width: 48, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, padding: 4, cursor: 'pointer' }} />
            <input type="text" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} style={{ ...inp, flex: 1, fontFamily: 'monospace' }} />
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{ ...btnPrimary(saving), marginTop: 16 }}>
        {saving ? 'جاري الحفظ...' : 'حفظ الهوية البصرية'}
      </button>
    </div>
  )
}
