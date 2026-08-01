'use client'
import { useRef, useState } from 'react'
import { C } from '@/lib/theme'
import { IconUpload, IconFileText, IconCheck } from '@tabler/icons-react'
import { useToast } from './adminUi'

const MAX_MB = 50

interface Props {
  flag: string
  label: string
  filePath: string | null
  version: string
  recommendedFilename: string
  onUploaded: (filePath: string, version: string) => void
}

function bumpVersion(v: string): string {
  const n = parseFloat(v)
  if (Number.isNaN(n)) return '1.0'
  return (Math.round((n + 0.1) * 10) / 10).toFixed(1)
}

// Real byte-level upload progress requires XMLHttpRequest — fetch() has no
// upload-progress event at all (its ReadableStream-based body only reports
// download progress). This is the one upload in the admin panel large
// enough (up to 50MB) for progress feedback to actually matter to the
// person watching it.
function uploadWithProgress(file: File, kind: string, onProgress: (pct: number) => void): Promise<{ path: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) resolve(json)
        else reject(new Error(json.error ?? `فشل الرفع (HTTP ${xhr.status})`))
      } catch {
        reject(new Error('فشل الرفع — استجابة غير صالحة من الخادم'))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('فشل الرفع — تحققي من الاتصال')))
    xhr.open('POST', '/api/admin/upload')
    xhr.send(form)
  })
}

export function DigitalProductUpload({ flag, label, filePath, version, recommendedFilename, onUploaded }: Props) {
  const [progress, setProgress] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      toast.push('error', 'صيغة الملف يجب أن تكون PDF فقط')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.push('error', `الحجم الأقصى المسموح ${MAX_MB} ميجابايت`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setProgress(0)
    try {
      const { path } = await uploadWithProgress(file, 'product-pdf', setProgress)
      onUploaded(path, bumpVersion(version))
      toast.push('success', `تم رفع ${label} بنجاح`)
    } catch (e: any) {
      toast.push('error', e.message ?? 'حدث خطأ أثناء الرفع')
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const busy = progress !== null

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>{flag}</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: C.text1 }}>{label}</span>
        </div>
        {filePath && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconCheck size={11} /> الإصدار {version}
          </span>
        )}
      </div>

      {filePath ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: C.text3, overflow: 'hidden' }}>
          <IconFileText size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>{filePath}</span>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#A32D2D', marginBottom: 10 }}>لم يُرفع أي ملف بعد لهذه اللغة</p>
      )}

      <p style={{ fontSize: 10, color: C.text3, lineHeight: 1.7, marginBottom: 10 }}>
        الصيغة الموصى بها: PDF · الحجم الأقصى: {MAX_MB} ميجابايت · الاسم المقترح: <span style={{ fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>{recommendedFilename}</span>
      </p>

      {busy && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ height: 6, background: C.surface, borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: C.primary, borderRadius: 999, transition: 'width .15s' }} />
          </div>
          <div style={{ fontSize: 10, color: C.text3, textAlign: 'center' }}>جاري الرفع... {progress}%</div>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', height: 40, border: `1px dashed ${C.border2}`, borderRadius: 10,
          background: '#fafafa', color: C.text2, fontSize: 12, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}
      >
        <IconUpload size={14} />
        {busy ? 'جاري الرفع...' : filePath ? 'استبدال الملف' : 'رفع ملف PDF'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        style={{ display: 'none' }}
      />
    </div>
  )
}
