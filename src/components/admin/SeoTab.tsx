'use client'
import { useEffect, useState } from 'react'
import { card, cardTitle, inp, label as labelStyle, focus, blur, btnPrimary, LoadingBlock, useToast } from './adminUi'
import { FileUploadField } from './FileUploadField'

interface SeoForm {
  meta_title: string; meta_description: string; meta_keywords: string; og_image_url: string | null
}

export function SeoTab() {
  const toast = useToast()
  const [form, setForm] = useState<SeoForm>({ meta_title: '', meta_description: '', meta_keywords: '', og_image_url: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const json = await res.json()
        if (!cancelled && res.ok && json.data) setForm(f => ({ ...f, ...json.data }))
      } catch { toast.push('error', 'تعذّر تحميل إعدادات SEO') }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [] ) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ')
      if (json.droppedFields?.length > 0) {
        toast.push('error', `تم الحفظ جزئياً — لم يُحفظ: ${json.droppedFields.join(', ')} (قاعدة البيانات تحتاج تحديث)`)
      } else {
        toast.push('success', 'تم حفظ إعدادات SEO')
      }
    } catch (e: any) { toast.push('error', e.message ?? 'حدث خطأ في الحفظ') }
    setSaving(false)
  }

  if (loading) return <LoadingBlock />

  return (
    <div>
      <div style={card}>
        <div style={cardTitle}>محركات البحث (SEO)</div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>عنوان الميتا (Meta Title)</label>
          <input value={form.meta_title} onFocus={focus} onBlur={blur} onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))} style={inp} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>وصف الميتا (Meta Description)</label>
          <textarea rows={3} value={form.meta_description} onFocus={focus as any} onBlur={blur as any} onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))} style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>الكلمات المفتاحية (مفصولة بفاصلة)</label>
          <input value={form.meta_keywords} onFocus={focus} onBlur={blur} onChange={e => setForm(f => ({ ...f, meta_keywords: e.target.value }))} style={inp} />
        </div>
        <FileUploadField
          label="صورة المشاركة (Open Graph)" kind="og" accept="image/png,image/jpeg,image/webp"
          value={form.og_image_url} onChange={url => setForm(f => ({ ...f, og_image_url: url }))}
          hint="تظهر عند مشاركة رابط الموقع في واتساب/تويتر — يفضّل 1200×630 بكسل"
        />
      </div>
      <button onClick={save} disabled={saving} style={{ ...btnPrimary(saving), marginTop: 16 }}>
        {saving ? 'جاري الحفظ...' : 'حفظ إعدادات SEO'}
      </button>
    </div>
  )
}
