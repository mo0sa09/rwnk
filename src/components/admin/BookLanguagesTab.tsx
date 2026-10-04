'use client'
import { useEffect, useRef, useState } from 'react'
import { C } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { IconUpload, IconFileText, IconCheck, IconPlus } from '@tabler/icons-react'
import { card, cardTitle, inp, label as labelStyle, focus, blur, btnPrimary, PageHeader, LoadingBlock, EmptyState, useToast, useConfirm } from './adminUi'

interface BookLanguage {
  id: string
  language_code: string
  name_ar: string
  name_en: string
  file_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface FormState {
  id: string | null // null => creating a new language
  language_code: string
  name_ar: string
  name_en: string
  is_active: boolean
  file_path: string | null
  file_name: string | null
  file_size: number | null
}

const EMPTY_FORM: FormState = {
  id: null, language_code: '', name_ar: '', name_en: '', is_active: false,
  file_path: null, file_name: null, file_size: null,
}

const CODE_RE = /^[a-z]{2,10}$/
const MAX_MB = 50

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('ar-KW', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return iso }
}

// Uploads straight from the browser to Supabase Storage using a short-lived
// signed URL, instead of proxying the PDF through /api/admin/upload (a
// Next.js serverless function). That route works fine for the small admin
// images it also handles, but Vercel caps a serverless function's request
// body at ~4.5MB regardless of this feature's 50MB limit — any larger PDF
// got rejected by Vercel's platform layer before our code ever ran, and that
// rejection isn't JSON, which is what produced "استجابة غير صالحة من
// الخادم". This endpoint only ever hands the server the metadata (language
// code, file name/size/type); the bytes never pass through our server, and
// /api/admin/book-languages/upload-url still requires an authenticated admin
// session before it will issue a token, scoped to one path, via the
// service-role key — the bucket stays private throughout.
async function uploadBookPdf(file: File, languageCode: string, onProgress: (pct: number) => void): Promise<{ path: string }> {
  onProgress(10)
  const res = await fetch('/api/admin/book-languages/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ languageCode, fileName: file.name, fileSize: file.size, mimeType: file.type }),
  })
  const prepared = await res.json().catch(() => null)
  if (!res.ok || !prepared) throw new Error(prepared?.error ?? `فشل تحضير الرفع (HTTP ${res.status})`)

  onProgress(35)
  const { error } = await supabase.storage.from('products').uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: 'application/pdf' })
  if (error) throw new Error(error.message || 'فشل الرفع إلى التخزين')

  onProgress(100)
  return { path: prepared.path }
}

export function BookLanguagesTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<BookLanguage[]>([])
  const [loading, setLoading] = useState(true)
  const [migrationError, setMigrationError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/book-languages')
        const json = await res.json()
        if (!cancelled) {
          setItems(json.data ?? [])
          setMigrationError(json.migrationRequired ? json.error : null)
        }
      } catch { /* keep previous items on transient failure */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function load() {
    try {
      const res = await fetch('/api/admin/book-languages')
      const json = await res.json()
      setItems(json.data ?? [])
      setMigrationError(json.migrationRequired ? json.error : null)
    } catch { /* keep previous items on transient failure */ }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM })
  }

  function openEdit(item: BookLanguage) {
    setForm({
      id: item.id, language_code: item.language_code, name_ar: item.name_ar, name_en: item.name_en,
      is_active: item.is_active, file_path: item.file_path, file_name: item.file_name, file_size: item.file_size,
    })
  }

  async function handleFile(file: File) {
    if (!form) return
    if (file.type !== 'application/pdf') { toast.push('error', 'صيغة الملف يجب أن تكون PDF فقط'); return }
    if (file.size > MAX_MB * 1024 * 1024) { toast.push('error', `الحجم الأقصى المسموح ${MAX_MB} ميجابايت`); return }
    const code = form.language_code.trim().toLowerCase()
    if (!CODE_RE.test(code)) { toast.push('error', 'أدخلي رمز لغة صالح أولاً (حروف إنجليزية صغيرة، 2-10 أحرف)'); return }

    setProgress(0)
    try {
      const { path } = await uploadBookPdf(file, code, setProgress)
      setForm(f => f ? { ...f, file_path: path, file_name: file.name, file_size: file.size } : f)
      toast.push('success', 'تم رفع الملف — اضغطي حفظ لإتمام العملية')
    } catch (e: any) {
      toast.push('error', e.message ?? 'حدث خطأ أثناء الرفع')
    } finally {
      setProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function save() {
    if (!form) return
    const code = form.language_code.trim().toLowerCase()
    if (!form.id && !CODE_RE.test(code)) {
      toast.push('error', 'رمز اللغة يجب أن يكون حروفاً إنجليزية صغيرة فقط (2-10 أحرف)')
      return
    }
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      toast.push('error', 'الاسم بالعربية والإنجليزية مطلوبان')
      return
    }
    if (form.is_active && !form.file_path) {
      toast.push('error', 'لا يمكن تفعيل لغة بدون رفع ملف PDF أولاً')
      return
    }

    setSaving(true)
    try {
      const isNew = !form.id
      const url = isNew ? '/api/admin/book-languages' : `/api/admin/book-languages/${form.id}`
      const body = isNew
        ? { language_code: code, name_ar: form.name_ar, name_en: form.name_en, is_active: form.is_active, file_path: form.file_path, file_name: form.file_name, file_size: form.file_size }
        : { name_ar: form.name_ar, name_en: form.name_en, is_active: form.is_active, file_path: form.file_path, file_name: form.file_name, file_size: form.file_size }
      const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ في الحفظ')
      toast.push('success', isNew ? 'تمت إضافة اللغة' : 'تم حفظ التعديلات')
      setForm(null)
      await load()
    } catch (e: any) {
      toast.push('error', e.message ?? 'حدث خطأ')
    }
    setSaving(false)
  }

  async function toggleActive(item: BookLanguage) {
    try {
      const res = await fetch(`/api/admin/book-languages/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !item.is_active }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
      toast.push('success', item.is_active ? 'تم إيقاف اللغة' : 'تم تفعيل اللغة')
    } catch (e: any) {
      toast.push('error', e.message ?? 'تعذّر تحديث الحالة')
    }
    await load()
  }

  function removeLanguage(item: BookLanguage) {
    confirm.ask(`حذف "${item.name_ar}" نهائياً؟ إذا كانت هناك طلبات سابقة بهذه اللغة سيتم رفض الحذف — استخدمي "إيقاف" بدلاً من ذلك.`, async () => {
      try {
        const res = await fetch(`/api/admin/book-languages/${item.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ أثناء الحذف')
        toast.push('success', 'تم حذف اللغة')
      } catch (e: any) {
        toast.push('error', e.message ?? 'تعذّر حذف اللغة')
      }
      await load()
    })
  }

  if (loading) return <div><PageHeader title="لغات الكتاب" /><LoadingBlock /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <PageHeader title="لغات الكتاب" subtitle="أضيفي لغات جديدة، ارفعي ملف PDF لكل لغة، وتحكّمي بظهورها في صفحة الدفع" />
        <button onClick={openCreate} disabled={!!migrationError} style={{ height: 40, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 6, background: migrationError ? C.surface : C.primary, color: migrationError ? C.text3 : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: migrationError ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          <IconPlus size={15} /> إضافة لغة
        </button>
      </div>

      {migrationError && (
        <div style={{ marginBottom: 14, padding: '10px 16px', background: '#FFF7E6', border: '1px solid #F5C453', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#7A5300' }}>
          {migrationError}
        </div>
      )}

      {form && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={cardTitle}>{form.id ? 'تعديل اللغة' : 'إضافة لغة جديدة'}</div>
          <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>الاسم بالعربية</label>
              <input value={form.name_ar} onFocus={focus} onBlur={blur} onChange={e => setForm(f => f && ({ ...f, name_ar: e.target.value }))} placeholder="الفرنسية" style={inp} />
            </div>
            <div>
              <label style={labelStyle}>الاسم بالإنجليزية</label>
              <input value={form.name_en} onFocus={focus} onBlur={blur} onChange={e => setForm(f => f && ({ ...f, name_en: e.target.value }))} placeholder="Français" style={inp} />
            </div>
            <div>
              <label style={labelStyle}>رمز اللغة {form.id && <span style={{ fontWeight: 400, textTransform: 'none', color: C.text3 }}>(غير قابل للتعديل)</span>}</label>
              <input
                value={form.language_code} disabled={!!form.id}
                onFocus={focus} onBlur={blur}
                onChange={e => setForm(f => f && ({ ...f, language_code: e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) }))}
                placeholder="fr" style={{ ...inp, direction: 'ltr', textAlign: 'left', opacity: form.id ? 0.6 : 1, cursor: form.id ? 'not-allowed' : 'text' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 40 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => f && ({ ...f, is_active: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>فعّالة (تظهر في صفحة الدفع)</span>
              </label>
            </div>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: C.text1 }}>ملف PDF</span>
              {form.file_path && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconCheck size={11} /> تم رفع ملف
                </span>
              )}
            </div>
            {form.file_name ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: C.text3, overflow: 'hidden' }}>
                <IconFileText size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>{form.file_name}</span>
                <span style={{ flexShrink: 0 }}>· {formatSize(form.file_size)}</span>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: '#A32D2D', marginBottom: 10 }}>لم يُرفع أي ملف بعد لهذه اللغة</p>
            )}
            {progress !== null && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ height: 6, background: C.surface, borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: C.primary, borderRadius: 999, transition: 'width .15s' }} />
                </div>
                <div style={{ fontSize: 10, color: C.text3, textAlign: 'center' }}>جاري الرفع... {progress}%</div>
              </div>
            )}
            <button
              type="button" disabled={progress !== null}
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 40, border: `1px dashed ${C.border2}`, borderRadius: 10, background: '#fafafa', color: C.text2, fontSize: 12, fontWeight: 700, cursor: progress !== null ? 'wait' : 'pointer', fontFamily: 'inherit' }}
            >
              <IconUpload size={14} /> {progress !== null ? 'جاري الرفع...' : form.file_path ? 'استبدال الملف' : 'رفع ملف PDF'}
            </button>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} style={{ display: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={save} disabled={saving} style={btnPrimary(saving)}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
            <button onClick={() => setForm(null)} style={{ height: 46, padding: '0 20px', background: '#fff', color: C.text3, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, padding: '6px 22px' }}>
        {items.length === 0 ? <EmptyState text="لا توجد لغات بعد" /> : items.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: C.text1 }}>{item.name_ar}</span>
                <span style={{ fontSize: 12, color: C.text3 }}>{item.name_en}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: C.surface, color: C.text2, fontFamily: 'monospace', direction: 'ltr' }}>{item.language_code}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: item.is_active ? '#E1F5EE' : '#FEF2F2', color: item.is_active ? '#085041' : '#A32D2D' }}>
                  {item.is_active ? 'فعّالة' : 'متوقفة'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.text3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {item.file_name ? (
                  <><IconFileText size={12} /> {item.file_name} · {formatSize(item.file_size)}</>
                ) : (
                  <span style={{ color: '#A32D2D' }}>لا يوجد ملف مرفوع</span>
                )}
                <span>· أُنشئت {formatDate(item.created_at)}</span>
                <span>· آخر تحديث {formatDate(item.updated_at)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => openEdit(item)} style={{ height: 30, padding: '0 12px', background: C.primaryLight, color: C.primary, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>تعديل / استبدال الملف</button>
              <button onClick={() => toggleActive(item)} style={{ height: 30, padding: '0 10px', background: item.is_active ? C.surface : C.primaryLight, color: item.is_active ? C.text3 : C.primary, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{item.is_active ? 'إيقاف' : 'تفعيل'}</button>
              <button onClick={() => removeLanguage(item)} style={{ height: 30, padding: '0 10px', background: '#FEF2F2', color: '#A32D2D', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
