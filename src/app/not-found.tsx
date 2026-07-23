import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Th','Noto Kufi Arabic',serif", direction: 'rtl', background: '#fff', color: '#1A1228',
      textAlign: 'center', padding: '40px 24px',
    }}>
      <div>
        <div style={{ marginBottom: 24 }}><svg width='80' height='80' viewBox='0 0 24 24' fill='none' stroke='#9890AA' strokeWidth='1.5'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg></div>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>الصفحة غير موجودة</h1>
        <p style={{ fontSize: 15, color: '#9890AA', marginBottom: 32, lineHeight: 1.6 }}>
          الرابط الذي فتحته غير موجود أو تم نقله.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{ background: '#6747B2', color: '#fff', fontSize: 14, fontWeight: 900, padding: '12px 24px', borderRadius: 12, display: 'inline-block' }}>
            الصفحة الرئيسية
          </Link>
          <Link href="/checkout" style={{ background: '#fff', color: '#6747B2', border: '1px solid #EDE8F5', fontSize: 14, fontWeight: 700, padding: '12px 24px', borderRadius: 12, display: 'inline-block' }}>
            اشترِ الآن
          </Link>
        </div>
      </div>
    </div>
  )
}
