'use client'
import { useRef, useState } from 'react'
import { C } from '@/lib/theme'
import { IconUpload, IconTrash, IconPhoto, IconInfoCircle } from '@tabler/icons-react'
import { useToast, useConfirm } from './adminUi'

interface Props {
  value: string | null
  onChange: (url: string | null) => void
}

const ACCEPT = 'image/png,image/jpeg,image/webp'
const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_MB = 5
const MIN_W = 1200
const MIN_H = 900
const TARGET_RATIO = 4 / 3
const RATIO_TOLERANCE = 0.08

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّرت قراءة الصورة')) }
    img.src = url
  })
}

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ url: string; path: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('kind', 'hero')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/upload')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) resolve(json)
        else reject(new Error(json.error ?? 'فشل الرفع'))
      } catch {
        reject(new Error('فشل الرفع'))
      }
    }
    xhr.onerror = () => reject(new Error('فشل الاتصال بالخادم'))
    xhr.send(form)
  })
}

export function HeroImageField({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const confirm = useConfirm()

  async function handleFile(file: File) {
    setError('')

    if (!TYPES.includes(file.type)) {
      setError('صيغة غير مدعومة — يُسمح فقط بـ PNG أو JPG أو WEBP')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`حجم الملف كبير جداً — الحد الأقصى ${MAX_MB}MB`)
      return
    }

    try {
      const { width, height } = await readImageDimensions(file)
      if (width < MIN_W || height < MIN_H) {
        setError(`الأبعاد صغيرة جداً (${width}×${height}px) — الحد الأدنى ${MIN_W}×${MIN_H}px`)
        return
      }
      const ratio = width / height
      if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE) {
        setError(`نسبة الأبعاد غير مناسبة (${width}×${height}px) — يجب أن تكون قريبة من 4:3`)
        return
      }
    } catch {
      setError('تعذّرت قراءة الصورة — جرّبي ملفاً آخر')
      return
    }

    setBusy(true)
    setProgress(0)
    try {
      const { url } = await uploadWithProgress(file, setProgress)
      onChange(url)
      toast.push('success', 'تم رفع صورة الهيرو بنجاح')
    } catch (e: any) {
      const message = e.message ?? 'حدث خطأ أثناء الرفع'
      setError(message)
      toast.push('error', message)
    } finally {
      setBusy(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleRemove() {
    confirm.ask('هل تريدين حذف صورة الهيرو؟ سيتم عرض الرسمة الافتراضية بدلاً منها بعد الحفظ.', () => {
      onChange(null)
      toast.push('success', 'تم حذف صورة الهيرو')
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="hero-image-field">
        {/* Preview */}
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 14,
          border: `1.5px dashed ${C.border2}`, background: C.surface, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary Supabase Storage URL
            <img src={value} alt="معاينة صورة الهيرو" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: C.text4, padding: 20 }}>
              <IconPhoto size={36} stroke={1.5} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 12, fontWeight: 700 }}>لا توجد صورة مرفوعة</p>
              <p style={{ fontSize: 11, marginTop: 2 }}>سيتم عرض الرسمة الافتراضية في الصفحة الرئيسية</p>
            </div>
          )}

          {busy && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(26,18,40,.55)', color: '#fff',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{ width: '60%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#fff', transition: 'width .15s ease' }} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 700 }}>جاري الرفع... {progress}%</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              flex: '1 1 160px', height: 44, border: `1px dashed ${C.border2}`, borderRadius: 10,
              background: '#fafafa', color: C.text2, fontSize: 12, fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            <IconUpload size={15} />
            {busy ? 'جاري الرفع...' : value ? 'استبدال الصورة' : 'رفع صورة'}
          </button>
          {value && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                height: 44, padding: '0 16px', border: `1px solid ${C.errorBg}`, borderRadius: 10,
                background: C.errorBg, color: '#A32D2D', fontSize: 12, fontWeight: 700,
                cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              <IconTrash size={15} />
              حذف
            </button>
          )}
        </div>

        {error && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A32D2D', background: C.errorBg, borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}

        {/* Info panel */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.primaryLight, borderRadius: 10, padding: '10px 12px' }}>
          <IconInfoCircle size={15} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: C.primaryText, lineHeight: 1.8 }}>
            <div>المقاس المُوصى به: <strong>1600×1200px</strong> — الحد الأدنى: <strong>1200×900px</strong></div>
            <div>نسبة الأبعاد المطلوبة: <strong>4:3</strong></div>
            <div>الصيغ المدعومة: <strong>PNG, JPG, WEBP</strong> — الحجم الأقصى: <strong>5MB</strong></div>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        style={{ display: 'none' }}
      />
    </div>
  )
}
