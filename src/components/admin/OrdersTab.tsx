'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { IconSearch, IconX } from '@tabler/icons-react'
import { card, inp, focus, blur, PageHeader, LoadingBlock, EmptyState } from './adminUi'

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: C.secondaryBg, color: '#085041', label: 'مكتمل' },
  pending:   { bg: C.primaryLight, color: C.primaryText, label: 'قيد التنفيذ' },
  refunded:  { bg: C.errorBg, color: C.error, label: 'ملغى' },
  failed:    { bg: C.errorBg, color: C.error, label: 'فشل' },
}
const STATUS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'pending', label: 'قيد التنفيذ' },
  { value: 'failed', label: 'فشل' },
  { value: 'refunded', label: 'ملغى' },
]

export function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const pageSize = 20

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status })
        if (search) params.set('search', search)
        const res = await fetch(`/api/admin/orders?${params}`)
        const json = await res.json()
        if (!cancelled && res.ok) { setOrders(json.data ?? []); setTotal(json.total ?? 0) }
      } catch {}
      if (!cancelled) setLoading(false)
    }, 300) // debounce search typing
    return () => { cancelled = true; clearTimeout(t) }
  }, [page, search, status])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <PageHeader title="الطلبات" subtitle={`${total} طلب`} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
          <IconSearch size={15} color={C.text4} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="بحث بالبريد أو رقم الفاتورة..." onFocus={focus} onBlur={blur}
            style={{ ...inp, paddingRight: 36 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setStatus(f.value); setPage(1) }} style={{
              height: 44, padding: '0 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: status === f.value ? C.primary : '#fff', color: status === f.value ? '#fff' : C.text2,
              border: `1px solid ${status === f.value ? C.primary : C.border}`,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: '6px 22px' }}>
        {loading ? <LoadingBlock /> : orders.length === 0 ? <EmptyState text="لا توجد طلبات مطابقة" /> : (
          <div className="admin-table-wrap">
            <div className="admin-table-min">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr 0.8fr 0.7fr 0.6fr', gap: 8, padding: '10px 12px' }}>
                {['الفاتورة', 'العميل', 'التاريخ', 'طريقة الدفع', 'الحالة', 'المبلغ'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</div>)}
              </div>
              {orders.map(o => {
                const st = STATUS[o.status] ?? STATUS.pending
                return (
                  <button key={o.id} onClick={() => setSelected(o)} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr 0.8fr 0.7fr 0.6fr', gap: 8, padding: '13px 12px',
                    borderTop: `1px solid ${C.border}`, alignItems: 'center', background: 'none', border: 'none', width: '100%',
                    textAlign: 'right', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>{o.invoice_number ?? '—'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name ?? o.email}</div>
                      {o.customer_name && <div style={{ fontSize: 10, color: C.text3 }}>{o.email}</div>}
                    </div>
                    <div style={{ fontSize: 10, color: C.text3 }}>{new Date(o.created_at).toLocaleDateString('ar-KW')}</div>
                    <div style={{ fontSize: 11, color: C.text2 }}>{o.payment_method ?? '—'}</div>
                    <div><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span></div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: C.text1 }}>{o.amount} {o.currency === 'KWD' ? 'د.ك' : o.currency}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 36, padding: '0 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, fontSize: 12, cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontFamily: 'inherit' }}>السابق</button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: C.text3, padding: '0 8px' }}>{page} / {pageCount}</span>
          <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} style={{ height: 36, padding: '0 14px', borderRadius: 9, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, fontSize: 12, cursor: page === pageCount ? 'default' : 'pointer', opacity: page === pageCount ? 0.4 : 1, fontFamily: 'inherit' }}>التالي</button>
        </div>
      )}

      {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function OrderDetailModal({ order, onClose }: { order: any; onClose: () => void }) {
  const st = STATUS[order.status] ?? STATUS.pending
  const rows: [string, string][] = [
    ['رقم الفاتورة', order.invoice_number ?? '—'],
    ['البريد الإلكتروني', order.email],
    ['اسم العميل', order.customer_name ?? '— (زائر)'],
    ['المبلغ', `${order.amount} ${order.currency === 'KWD' ? 'د.ك' : order.currency}`],
    ['طريقة الدفع', order.payment_method ?? '—'],
    ['مرجع المعاملة', order.payment_ref ?? '—'],
    ['تاريخ الشراء', new Date(order.created_at).toLocaleString('ar-KW')],
    ['التحميلات', `${order.downloads_used ?? 0} / ${order.downloads_limit ?? 0}`],
    ['حساب مُنشأ', order.account_created ? 'نعم' : 'لا'],
  ]
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,18,40,.45)', zIndex: 1001,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, padding: '26px 28px', maxWidth: 440, width: '100%',
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.text1 }}>تفاصيل الطلب</div>
          <button onClick={onClose} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3 }}><IconX size={20} /></button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            <span style={{ color: C.text3, flexShrink: 0 }}>{k}</span>
            <span style={{ color: C.text1, fontWeight: 700, textAlign: 'left', wordBreak: 'break-word' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
