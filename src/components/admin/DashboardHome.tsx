'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { IconCircleCheck } from '@tabler/icons-react'
import { W, card, LoadingBlock, EmptyState } from './adminUi'

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: C.secondaryBg, color: '#085041', label: 'مكتمل' },
  pending:   { bg: C.primaryLight, color: C.primaryText, label: 'قيد التنفيذ' },
  refunded:  { bg: C.errorBg, color: C.error, label: 'ملغى' },
  failed:    { bg: C.errorBg, color: C.error, label: 'فشل' },
}

interface Analytics {
  revenue: number; totalOrders: number; completedOrders: number; customers: number
  downloads: number; avgOrderValue: number
  series: { label: string; revenue: number; orders: number }[]
  recentPayments: any[]
}

export function DashboardHome({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/analytics?range=daily')
        const json = await res.json()
        if (!cancelled && res.ok) setData(json.data)
      } catch { /* keep null -> empty state */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const last7 = data?.series.slice(-7) ?? []
  const maxRevenue = Math.max(1, ...last7.map(d => d.revenue))

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 4 }}>مرحباً بك، المشرف</h1>
        <p style={{ fontSize: 13, color: C.text3 }}>إليك ملخص أداء رَوْنَق</p>
      </div>

      <div className="admin-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'إجمالي الإيرادات', value: loading ? '...' : data?.revenue.toFixed(3) ?? '0.000', unit: 'د.ك' },
          { label: 'الطلبات المكتملة', value: loading ? '...' : String(data?.completedOrders ?? 0), unit: '' },
          { label: 'العملاء', value: loading ? '...' : String(data?.customers ?? 0), unit: '' },
          { label: 'متوسط قيمة الطلب', value: loading ? '...' : data?.avgOrderValue.toFixed(3) ?? '0.000', unit: 'د.ك' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '20px 22px' }}>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: C.text1, letterSpacing: -1 }}>{s.value}</span>
              {s.unit && <span style={{ fontSize: 13, color: C.text3 }}>{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="admin-chart-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, marginBottom: 18 }}>
        <div style={{ background: `linear-gradient(145deg,${C.primary},#8b6dd4)`, borderRadius: 18, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconCircleCheck size={22} color="rgba(255,255,255,0.8)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: W }}>كل شيء يعمل</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{data?.downloads ?? 0} تحميل حتى الآن</div>
          <button onClick={() => onNavigate('analytics')} style={{ marginTop: 4, height: 33, padding: '0 16px', background: W, color: C.primary, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>
            التحليلات الكاملة
          </button>
        </div>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 900, color: C.text1, marginBottom: 18 }}>الإيرادات — آخر 7 أيام</div>
          {loading ? <LoadingBlock /> : last7.length === 0 ? <EmptyState text="لا توجد بيانات مبيعات بعد" /> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, paddingBottom: 24, position: 'relative' }}>
              {[0.25, 0.5, 0.75, 1].map(f => <div key={f} style={{ position: 'absolute', left: 0, right: 0, bottom: 24 + f * 85, height: 1, background: C.border }} />)}
              {last7.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.text3, marginBottom: 3 }}>{d.revenue.toFixed(1)}</div>
                  <div style={{ width: '100%', borderRadius: '5px 5px 0 0', height: `${(d.revenue / maxRevenue) * 85}px`, background: `linear-gradient(to top,${C.primary},#a07ee8)`, minHeight: 4 }} />
                  <div style={{ position: 'absolute', bottom: -18, fontSize: 9, color: C.text3, whiteSpace: 'nowrap' }}>{d.label.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: C.text1 }}>آخر الطلبات المدفوعة</div>
          <button onClick={() => onNavigate('orders')} style={{ fontSize: 12, color: C.primary, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>عرض الكل ←</button>
        </div>
        {loading ? <LoadingBlock /> : !data?.recentPayments.length ? <EmptyState text="لا توجد طلبات بعد" /> : (
          <div className="admin-table-wrap">
            <div className="admin-table-min">
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 0.9fr 0.7fr 0.5fr', gap: 8, padding: '7px 12px', marginBottom: 4 }}>
                {['المعرّف', 'العميل', 'التاريخ', 'الحالة', 'المبلغ'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' }}>{h}</div>)}
              </div>
              {data.recentPayments.map((p, i) => {
                const st = STATUS[p.status] ?? STATUS.pending
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 0.9fr 0.7fr 0.5fr', gap: 8, padding: '11px 12px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>{p.invoice_number ?? '—'}</div>
                    <div style={{ fontSize: 12, color: C.text1 }}>{p.email}</div>
                    <div style={{ fontSize: 10, color: C.text3 }}>{new Date(p.created_at).toLocaleDateString('ar-KW')}</div>
                    <div><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span></div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: C.text1 }}>{p.amount} د.ك</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
