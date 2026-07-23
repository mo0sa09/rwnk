'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Th','Noto Kufi Arabic',serif", direction: 'rtl', background: '#fff', color: '#1A1228',
      textAlign: 'center', padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px', background: '#FEF2F2', border: '1.5px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, marginBottom: 10 }}>حدث خطأ غير متوقع</h1>
        <p style={{ fontSize: 14, color: '#9890AA', lineHeight: 1.7, marginBottom: 28 }}>
          نعتذر عن هذا الإزعاج. يمكنك إعادة المحاولة، وإذا استمرت المشكلة تواصلي معنا.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()} style={{ background: '#6747B2', color: '#fff', fontSize: 14, fontWeight: 900, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Th',serif" }}>
            إعادة المحاولة
          </button>
          <Link href="/" style={{ background: '#fff', color: '#6747B2', border: '1px solid #EDE8F5', fontSize: 14, fontWeight: 700, padding: '12px 24px', borderRadius: 12, display: 'inline-block' }}>
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  )
}
