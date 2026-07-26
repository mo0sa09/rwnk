'use client'
import { useRef, useState } from 'react'
import { C } from '@/lib/theme'
import { IconUpload, IconPhoto } from '@tabler/icons-react'
import { label as labelStyle, useToast } from './adminUi'

type Kind = 'logo' | 'favicon' | 'og' | 'image' | 'product-pdf'

interface Props {
  label: string
  kind: Kind
  value: string | null
  onChange: (url: string) => void
  accept?: string
  hint?: string
  previewKind?: 'image' | 'none'
}

// Uploads through /api/admin/upload (service-role, admin-only) then hands the
// resulting public URL back to the parent form — the parent still owns
// persisting that URL into store_settings/products via its own save button,
// so nothing here writes to the database directly.
export function FileUploadField({ label: fieldLabel, kind, value, onChange, accept, hint, previewKind = 'image' }: Props) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function handleFile(file: File) {
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'فشل الرفع')
      onChange(json.url ?? json.path)
      toast.push('success', 'تم رفع الملف بنجاح')
    } catch (e: any) {
      toast.push('error', e.message ?? 'حدث خطأ أثناء الرفع')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{fieldLabel}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {previewKind === 'image' && (
          <div style={{
            width: 52, height: 52, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
          }}>
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, arbitrary external URL preview
              <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <IconPhoto size={20} color={C.text4} />
            )}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', height: 44, border: `1px dashed ${C.border2}`, borderRadius: 10,
              background: '#fafafa', color: C.text2, fontSize: 12, fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            <IconUpload size={15} />
            {busy ? 'جاري الرفع...' : value ? 'استبدال الملف' : 'رفع ملف'}
          </button>
          {hint && <p style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        style={{ display: 'none' }}
      />
    </div>
  )
}
