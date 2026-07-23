'use client'
import { useEffect } from 'react'

// Catches errors thrown from the root layout itself — must render its own
// <html>/<body> since it replaces the entire document in that case.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Th','Noto Kufi Arabic',serif", direction: 'rtl', background: '#fff', color: '#1A1228',
          textAlign: 'center', padding: '40px 24px',
        }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, marginBottom: 10 }}>حدث خطأ في الموقع</h1>
            <p style={{ fontSize: 14, color: '#9890AA', lineHeight: 1.7, marginBottom: 28 }}>
              يرجى إعادة تحميل الصفحة. إذا استمرت المشكلة، تواصلي معنا.
            </p>
            <button onClick={() => reset()} style={{ background: '#6747B2', color: '#fff', fontSize: 14, fontWeight: 900, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Th',serif" }}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
