'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { card, cardTitle, inp, label as labelStyle, focus, blur, btnPrimary, PageHeader, LoadingBlock, EmptyState, useToast, useConfirm } from './adminUi'
import { FileUploadField } from './FileUploadField'
import { DigitalProductUpload } from './DigitalProductUpload'

interface ProductForm {
  product_name: string; product_price: number; product_original_price: number
  product_description: string; product_image_url: string | null; downloads_limit: number
}
interface ProductFileState {
  file_path: string | null; version: string
  file_path_ar: string | null; version_ar: string
  file_path_en: string | null; version_en: string
}
interface DiscountCode {
  id: string; code: string; discount_type: 'percent' | 'fixed'
  discount_value: number; max_uses: number | null; used_count: number
  expires_at: string | null; is_active: boolean
}

// The bilingual columns (file_path_ar/version_ar/file_path_en/version_en)
// may not exist yet on a database that hasn't had supabase/schema.sql §15
// applied — select('*') on /api/admin/product-file's GET never errors on a
// missing column (unlike an explicit column list would), so this just
// normalizes whatever subset actually came back into a consistent shape
// instead of the UI reading `undefined` in various places.
function normalizeProductFile(data: any): ProductFileState {
  return {
    file_path: data?.file_path ?? null,
    version: data?.version ?? '1.0',
    file_path_ar: data?.file_path_ar ?? null,
    version_ar: data?.version_ar ?? '1.0',
    file_path_en: data?.file_path_en ?? null,
    version_en: data?.version_en ?? '1.0',
  }
}

export function ProductTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState<ProductForm>({
    product_name: '', product_price: 0, product_original_price: 0,
    product_description: '', product_image_url: null, downloads_limit: 5,
  })
  const [productFile, setProductFile] = useState<ProductFileState | null>(null)
  const [discounts, setDiscounts] = useState<DiscountCode[]>([])
  const [newDisc, setNewDisc] = useState({ code: '', type: 'percent', value: '', maxUses: '', expiresAt: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Re-fetch after a mutation — called from event handlers below, never from
  // an effect, so it can stay a plain reusable async function.
  async function load() {
    setLoading(true)
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/product-file'),
        fetch('/api/admin/discounts'),
      ])
      const [sJson, pJson, dJson] = await Promise.all([sRes.json(), pRes.json(), dRes.json()])
      if (sRes.ok && sJson.data) setForm(f => ({ ...f, ...sJson.data }))
      if (pRes.ok && pJson.data) setProductFile(normalizeProductFile(pJson.data))
      if (dRes.ok) setDiscounts(dJson.data ?? [])
    } catch { toast.push('error', 'تعذّر تحميل بيانات المنتج') }
    setLoading(false)
  }

  // Mount fetch lives inline (not a call to the outer `load`) per
  // react-hooks/set-state-in-effect — calling a component-scope helper from
  // an effect reads as the "sync back to React" anti-pattern the rule targets.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [sRes, pRes, dRes] = await Promise.all([
          fetch('/api/admin/settings'),
          fetch('/api/admin/product-file'),
          fetch('/api/admin/discounts'),
        ])
        const [sJson, pJson, dJson] = await Promise.all([sRes.json(), pRes.json(), dRes.json()])
        if (cancelled) return
        if (sRes.ok && sJson.data) setForm(f => ({ ...f, ...sJson.data }))
        if (pRes.ok && pJson.data) setProductFile(normalizeProductFile(pJson.data))
        if (dRes.ok) setDiscounts(dJson.data ?? [])
      } catch { if (!cancelled) toast.push('error', 'تعذّر تحميل بيانات المنتج') }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveProduct() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ')
      if (json.droppedFields?.length > 0) {
        toast.push('error', `تم الحفظ جزئياً — لم يُحفظ: ${json.droppedFields.join(', ')} (قاعدة البيانات تحتاج تحديث)`)
      } else {
        toast.push('success', 'تم حفظ بيانات المنتج')
      }
    } catch (e: any) { toast.push('error', e.message ?? 'حدث خطأ في الحفظ') }
    setSaving(false)
  }

  async function handleDigitalFileUploaded(language: 'ar' | 'en', path: string, version: string) {
    const pathField = language === 'ar' ? 'file_path_ar' : 'file_path_en'
    const versionField = language === 'ar' ? 'version_ar' : 'version_en'
    try {
      const res = await fetch('/api/admin/product-file', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [pathField]: path, [versionField]: version }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ')
      setProductFile(normalizeProductFile(json.data))
      if (json.droppedFields?.length > 0) {
        toast.push('error', `تحذير: لم يتم حفظ ${json.droppedFields.join(', ')} — قاعدة البيانات تحتاج تحديث (راجعي إعدادات الحساب)`)
      } else {
        toast.push('success', 'تم رفع الملف بنجاح')
      }
    } catch (e: any) { toast.push('error', e.message ?? 'حدث خطأ') }
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
      setNewDisc({ code: '', type: 'percent', value: '', maxUses: '', expiresAt: '' })
      toast.push('success', 'تمت إضافة الكود')
      load()
    } catch (e: any) { toast.push('error', e.message) }
  }

  async function toggleDiscount(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/admin/discounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
    } catch (e: any) {
      toast.push('error', e.message ?? 'تعذّر تحديث حالة الكود')
    }
    load()
  }

  function removeDiscount(id: string) {
    confirm.ask('حذف هذا الكود نهائياً؟ لا يمكن التراجع عن هذا الإجراء.', async () => {
      try {
        const res = await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
        toast.push('success', 'تم حذف الكود')
      } catch (e: any) {
        toast.push('error', e.message ?? 'تعذّر حذف الكود')
      }
      load()
    })
  }

  if (loading) return <div><PageHeader title="إدارة المنتج" /><LoadingBlock /></div>

  return (
    <div>
      <PageHeader title="إدارة المنتج" subtitle="عدّلي بيانات الكتاب وأكواد الخصم" />

      <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <div style={cardTitle}>تفاصيل المنتج</div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>اسم المنتج</label>
            <input value={form.product_name} onFocus={focus} onBlur={blur} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} style={inp} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>السعر الأصلي (د.ك)</label>
              <input type="number" step="0.001" value={form.product_original_price} onFocus={focus} onBlur={blur} onChange={e => setForm(f => ({ ...f, product_original_price: parseFloat(e.target.value) || 0 }))} style={inp} />
            </div>
            <div>
              <label style={labelStyle}>السعر الحالي (د.ك)</label>
              <input type="number" step="0.001" value={form.product_price} onFocus={focus} onBlur={blur} onChange={e => setForm(f => ({ ...f, product_price: parseFloat(e.target.value) || 0 }))} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>حد التحميلات للعميل الواحد</label>
            <input type="number" value={form.downloads_limit} onFocus={focus} onBlur={blur} onChange={e => setForm(f => ({ ...f, downloads_limit: parseInt(e.target.value) || 0 }))} style={inp} />
          </div>
          <div>
            <label style={labelStyle}>وصف المنتج</label>
            <textarea rows={3} value={form.product_description} onFocus={focus as any} onBlur={blur as any} onChange={e => setForm(f => ({ ...f, product_description: e.target.value }))} style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>الوسائط والملفات</div>
          <FileUploadField
            label="صورة المنتج" kind="image" accept="image/png,image/jpeg,image/webp"
            value={form.product_image_url} onChange={url => setForm(f => ({ ...f, product_image_url: url }))}
            hint="تظهر في قسم الهيرو بالصفحة الرئيسية وكغلاف الكتاب في صفحة نجاح الدفع"
          />

          <div style={{ marginTop: 20, background: C.surface, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, marginBottom: 8 }}>معاينة بطاقة السعر</div>
            <div style={{ fontSize: 11, color: C.text3 }}>{form.product_name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              {form.product_original_price > form.product_price && (
                <span style={{ fontSize: 14, color: C.text3, textDecoration: 'line-through' }}>{form.product_original_price} د.ك</span>
              )}
              <span style={{ fontSize: 28, fontWeight: 900, color: C.primary }}>{form.product_price} <span style={{ fontSize: 14, fontWeight: 400, color: C.text3 }}>د.ك</span></span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={cardTitle}>المنتج الرقمي</div>
        <p style={{ fontSize: 11, color: C.text3, marginTop: -10, marginBottom: 16 }}>
          ارفعي نسخة الكتاب بكل لغة على حدة — يتم اختيار الملف المناسب تلقائياً حسب اللغة التي يختارها العميل عند الدفع.
        </p>
        <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <DigitalProductUpload
            flag="🇸🇦" label="النسخة العربية"
            filePath={productFile?.file_path_ar ?? null} version={productFile?.version_ar ?? '1.0'}
            recommendedFilename="rwnk-guide-ar.pdf"
            onUploaded={(path, version) => handleDigitalFileUploaded('ar', path, version)}
          />
          <DigitalProductUpload
            flag="🇺🇸" label="النسخة الإنجليزية"
            filePath={productFile?.file_path_en ?? null} version={productFile?.version_en ?? '1.0'}
            recommendedFilename="rwnk-guide-en.pdf"
            onUploaded={(path, version) => handleDigitalFileUploaded('en', path, version)}
          />
        </div>
      </div>

      <button onClick={saveProduct} disabled={saving} style={{ ...btnPrimary(saving), marginBottom: 28 }}>
        {saving ? 'جاري الحفظ...' : 'حفظ بيانات المنتج'}
      </button>

      <div style={card}>
        <div style={cardTitle}>أكواد الخصم</div>
        <div className="admin-discounts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>الكود</label>
              <input placeholder="RWNK20" value={newDisc.code} onChange={e => setNewDisc(d => ({ ...d, code: e.target.value.toUpperCase() }))} onFocus={focus} onBlur={blur} style={{ ...inp, textTransform: 'uppercase' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>النوع</label>
                <select value={newDisc.type} onChange={e => setNewDisc(d => ({ ...d, type: e.target.value }))} onFocus={focus as any} onBlur={blur as any} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="percent">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت (د.ك)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>القيمة</label>
                <input type="number" placeholder={newDisc.type === 'percent' ? '20' : '3'} value={newDisc.value} onChange={e => setNewDisc(d => ({ ...d, value: e.target.value }))} onFocus={focus} onBlur={blur} style={inp} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>أقصى استخدام (اختياري)</label>
                <input type="number" placeholder="بدون حد" value={newDisc.maxUses} onChange={e => setNewDisc(d => ({ ...d, maxUses: e.target.value }))} onFocus={focus} onBlur={blur} style={inp} />
              </div>
              <div>
                <label style={labelStyle}>تاريخ الانتهاء</label>
                <input type="date" value={newDisc.expiresAt} onChange={e => setNewDisc(d => ({ ...d, expiresAt: e.target.value }))} onFocus={focus} onBlur={blur} style={inp} />
              </div>
            </div>
            <button onClick={addDiscount} style={{ width: '100%', ...btnPrimary(false), height: 44 }}>إضافة الكود</button>
          </div>

          <div>
            {discounts.length === 0 ? <EmptyState text="لا توجد أكواد بعد" /> : discounts.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: C.text1, fontFamily: 'monospace' }}>{d.code}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: d.is_active ? C.secondaryBg : C.surface, color: d.is_active ? '#085041' : C.text3 }}>{d.is_active ? 'فعّال' : 'متوقف'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>
                    {d.discount_type === 'percent' ? `${d.discount_value}% خصم` : `${d.discount_value} د.ك خصم`}
                    {d.max_uses ? ` · ${d.used_count}/${d.max_uses} استخدام` : ` · ${d.used_count} استخدام`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => toggleDiscount(d.id, d.is_active)} style={{ height: 30, padding: '0 10px', background: d.is_active ? C.surface : C.primaryLight, color: d.is_active ? C.text3 : C.primary, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{d.is_active ? 'إيقاف' : 'تفعيل'}</button>
                  <button onClick={() => removeDiscount(d.id)} style={{ height: 30, padding: '0 10px', background: '#FEF2F2', color: '#A32D2D', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>حذف</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
