export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Th','Noto Kufi Arabic',serif", direction: 'rtl', background: '#fff',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #EDE8F5', borderTopColor: '#6747B2',
          animation: 'spin 0.7s linear infinite',
        }} />
        <span style={{ fontSize: 13, color: '#9890AA' }}>جاري التحميل...</span>
      </div>
    </div>
  )
}
