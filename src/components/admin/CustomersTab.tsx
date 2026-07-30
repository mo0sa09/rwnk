'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { IconSearch } from '@tabler/icons-react'
import { card, inp, focus, blur, PageHeader, LoadingBlock, EmptyState } from './adminUi'

export function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams(search ? { search } : {})
        const res = await fetch(`/api/admin/customers?${params}`)
        const json = await res.json()
        if (!cancelled && res.ok) setCustomers(json.data ?? [])
      } catch {}
      if (!cancelled) setLoading(false)
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search])

  return (
    <div>
      <PageHeader title="العملاء" subtitle={`${customers.length} عميل (اشتروا بنجاح)`} />

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
        <IconSearch size={15} color={C.text4} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالبريد الإلكتروني..." onFocus={focus} onBlur={blur} style={{ ...inp, paddingRight: 36 }} />
      </div>

      <div style={{ ...card, padding: '6px 22px' }}>
        {loading ? <LoadingBlock /> : customers.length === 0 ? <EmptyState text="لا يوجد عملاء بعد" /> : (
          <div className="admin-table-wrap">
            <div className="admin-table-min">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px' }}>
                {['العميل', 'عدد الطلبات', 'إجمالي الإنفاق', 'آخر شراء'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase' }}>{h}</div>)}
              </div>
              {customers.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '13px 12px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.primaryLight, color: C.primaryText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{c.email[0].toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.text2 }}>{c.order_count}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.primary }}>{c.total_spent.toFixed(3)} د.ك</div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{new Date(c.last_purchase).toLocaleDateString('ar-KW')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
