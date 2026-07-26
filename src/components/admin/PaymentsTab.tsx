'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { card, PageHeader, LoadingBlock, EmptyState } from './adminUi'

const METHOD_LABELS: Record<string, string> = { card: 'بطاقة ائتمان', knet: 'KNET', apple: 'Apple Pay' }

export function PaymentsTab() {
  const [analytics, setAnalytics] = useState<any | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [gateway, setGateway] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [aRes, oRes, sRes] = await Promise.all([
          fetch('/api/admin/analytics?range=daily'),
          fetch('/api/admin/orders?pageSize=15'),
          fetch('/api/admin/system-status'),
        ])
        const [aJson, oJson, sJson] = await Promise.all([aRes.json(), oRes.json(), sRes.json()])
        if (cancelled) return
        if (aRes.ok) setAnalytics(aJson.data)
        if (oRes.ok) setPayments(oJson.data ?? [])
        if (sRes.ok) setGateway(sJson.data.paymentGateway)
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const successCount = analytics?.statusBreakdown?.completed ?? 0
  const failedCount = (analytics?.statusBreakdown?.failed ?? 0) + (analytics?.statusBreakdown?.refunded ?? 0)
  const pendingCount = analytics?.statusBreakdown?.pending ?? 0

  return (
    <div>
      <PageHeader title="المدفوعات" subtitle="نظرة شاملة على كل المعاملات المالية" />

      {loading ? <LoadingBlock /> : (
        <>
          <div className="admin-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
            <div style={{ ...card, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>إجمالي المُستلم</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text1 }}>{analytics?.revenue.toFixed(3) ?? '0.000'} د.ك</div>
            </div>
            <div style={{ ...card, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>مدفوعات ناجحة</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#085041' }}>{successCount}</div>
            </div>
            <div style={{ ...card, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>مدفوعات فاشلة/ملغاة</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#A32D2D' }}>{failedCount}</div>
            </div>
            <div style={{ ...card, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>بانتظار الدفع</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.primaryText }}>{pendingCount}</div>
            </div>
          </div>

          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.text1, marginBottom: 12 }}>بوابة الدفع الحالية</div>
            <p style={{ fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
              البوابة المُفعّلة حالياً على الخادم: <strong style={{ color: C.text1 }}>{gateway}</strong>.
              يتم تغييرها عبر متغيّر البيئة <code style={{ background: C.surface, padding: '1px 6px', borderRadius: 5 }}>PAYMENT_GATEWAY</code> في إعدادات الاستضافة (myfatoorah أو tap) — راجعي تبويب الإعدادات العامة لحالة الاتصال.
            </p>
          </div>

          <div style={{ ...card, padding: '6px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.text1, margin: '16px 0' }}>آخر المعاملات</div>
            {payments.length === 0 ? <EmptyState text="لا توجد معاملات بعد" /> : (
              <div className="admin-table-wrap">
                <div className="admin-table-min">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr 0.8fr 0.7fr', gap: 8, padding: '7px 12px' }}>
                    {['المرجع', 'العميل', 'التاريخ', 'الطريقة', 'المبلغ'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</div>)}
                  </div>
                  {payments.map(p => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr 0.8fr 0.7fr', gap: 8, padding: '12px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.payment_ref ?? p.invoice_number ?? '—'}</div>
                      <div style={{ fontSize: 12, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                      <div style={{ fontSize: 10, color: C.text3 }}>{new Date(p.created_at).toLocaleDateString('ar-KW')}</div>
                      <div style={{ fontSize: 11, color: C.text2 }}>{METHOD_LABELS[p.payment_method] ?? p.payment_method ?? '—'}</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: C.text1 }}>{p.amount} د.ك</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
