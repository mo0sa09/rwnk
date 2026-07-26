'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { card, PageHeader, LoadingBlock, EmptyState } from './adminUi'

const METHOD_LABELS: Record<string, string> = { card: 'بطاقة ائتمان', knet: 'KNET', apple: 'Apple Pay', unknown: 'غير معروف' }
const STATUS_LABELS: Record<string, string> = { completed: 'مكتمل', pending: 'قيد التنفيذ', failed: 'فشل', refunded: 'ملغى' }
const STATUS_COLORS: Record<string, string> = { completed: '#085041', pending: C.primaryText, failed: '#A32D2D', refunded: '#A32D2D' }

interface Analytics {
  revenue: number; totalOrders: number; completedOrders: number; customers: number; downloads: number; avgOrderValue: number
  statusBreakdown: Record<string, number>
  methodBreakdown: Record<string, { count: number; revenue: number }>
  series: { label: string; revenue: number; orders: number }[]
}

export function AnalyticsTab() {
  const [range, setRange] = useState<'daily' | 'monthly'>('daily')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`)
        const json = await res.json()
        if (!cancelled && res.ok) setData(json.data)
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [range])

  const series = data?.series ?? []
  const maxRevenue = Math.max(1, ...series.map(d => d.revenue))
  const totalStatus = Object.values(data?.statusBreakdown ?? {}).reduce((a, b) => a + b, 0) || 1

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <PageHeader title="التحليلات" subtitle="أداء المبيعات والمدفوعات بالتفصيل" />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['daily', 'monthly'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              height: 36, padding: '0 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: range === r ? C.primary : '#fff', color: range === r ? '#fff' : C.text2,
              border: `1px solid ${range === r ? C.primary : C.border}`,
            }}>
              {r === 'daily' ? 'يومي (٩٠ يوم)' : 'شهري (١٢ شهر)'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingBlock /> : (
        <>
          <div className="admin-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
            {[
              { label: 'إجمالي الإيرادات', value: `${data?.revenue.toFixed(3) ?? '0.000'} د.ك` },
              { label: 'كل الطلبات', value: String(data?.totalOrders ?? 0) },
              { label: 'العملاء الفريدون', value: String(data?.customers ?? 0) },
              { label: 'متوسط قيمة الطلب', value: `${data?.avgOrderValue.toFixed(3) ?? '0.000'} د.ك` },
            ].map((s, i) => (
              <div key={i} style={{ ...card, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.text1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.text1, marginBottom: 18 }}>
              {range === 'daily' ? 'الإيرادات اليومية' : 'الإيرادات الشهرية'}
            </div>
            {series.length === 0 ? <EmptyState text="لا توجد بيانات مبيعات في هذه الفترة" /> : (
              <div className="table-scroll">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: series.length > 40 ? 3 : 8, height: 140, paddingBottom: 24, position: 'relative', minWidth: series.length > 20 ? series.length * 14 : undefined }}>
                  {[0.25, 0.5, 0.75, 1].map(f => <div key={f} style={{ position: 'absolute', left: 0, right: 0, bottom: 24 + f * 110, height: 1, background: C.border }} />)}
                  {series.map((d, i) => (
                    <div key={i} title={`${d.label}: ${d.revenue.toFixed(3)} د.ك (${d.orders} طلب)`} style={{ flex: 1, minWidth: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${(d.revenue / maxRevenue) * 110}px`, background: `linear-gradient(to top,${C.primary},#a07ee8)`, minHeight: 3 }} />
                      {(series.length <= 14 || i % Math.ceil(series.length / 14) === 0) && (
                        <div style={{ position: 'absolute', bottom: -18, fontSize: 9, color: C.text3, whiteSpace: 'nowrap' }}>
                          {range === 'monthly' ? d.label : d.label.slice(5)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.text1, marginBottom: 16 }}>حسب طريقة الدفع</div>
              {Object.keys(data?.methodBreakdown ?? {}).length === 0 ? <EmptyState text="لا توجد مدفوعات ناجحة بعد" /> : (
                Object.entries(data!.methodBreakdown).map(([method, v]) => (
                  <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 13, color: C.text2 }}>{METHOD_LABELS[method] ?? method}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: C.text1 }}>{v.revenue.toFixed(3)} د.ك <span style={{ fontSize: 11, fontWeight: 400, color: C.text3 }}>({v.count})</span></span>
                  </div>
                ))
              )}
            </div>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.text1, marginBottom: 16 }}>حسب حالة الطلب</div>
              {Object.entries(data?.statusBreakdown ?? {}).filter(([, n]) => n > 0).map(([status, n]) => (
                <div key={status} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: C.text2 }}>{STATUS_LABELS[status] ?? status}</span>
                    <span style={{ fontWeight: 700, color: STATUS_COLORS[status] ?? C.text1 }}>{n}</span>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(n / totalStatus) * 100}%`, background: STATUS_COLORS[status] ?? C.primary, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
