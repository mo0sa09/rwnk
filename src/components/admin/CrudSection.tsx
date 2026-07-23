'use client'
import { useState, useEffect } from 'react'
import { C } from '@/lib/theme'

export interface CrudField {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  placeholder?: string
}

interface CrudSectionProps {
  resource: string
  title: string
  description: string
  fields: CrudField[]
  emptyItem: Record<string, unknown>
  reorderable?: boolean
  renderLabel: (item: any) => string
  renderMeta?: (item: any) => string
}

const W = '#fff'
const inp: React.CSSProperties = {
  width: '100%', minHeight: 40, background: '#fafafa', border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '8px 12px', fontSize: 13, color: C.text1, outline: 'none',
  fontFamily: "'Th',serif",
}

export function CrudSection({ resource, title, description, fields, emptyItem, reorderable, renderLabel, renderMeta }: CrudSectionProps) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Mount/resource-change fetch lives inline in the effect (not a call to an
  // outer `load`) per react-hooks/set-state-in-effect — calling a
  // component-scope helper from an effect reads as the "sync back to React"
  // anti-pattern the rule targets, even though this one's a plain fetch.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/${resource}`)
        const json = await res.json()
        if (!cancelled) setItems(json.data ?? [])
      } catch { /* keep previous items on transient failure */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [resource])

  // Re-fetch after a mutation — called from event handlers below, never from
  // an effect, so it can stay a plain reusable async function.
  async function load() {
    try {
      const res = await fetch(`/api/admin/${resource}`)
      const json = await res.json()
      setItems(json.data ?? [])
    } catch { /* keep previous items on transient failure */ }
    setLoading(false)
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const url = isNew ? `/api/admin/${resource}` : `/api/admin/${resource}/${editing.id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ في الحفظ')
      setEditing(null)
      setMsg('✓ تم الحفظ بنجاح')
      await load()
    } catch (e: any) {
      setMsg(`✗ ${e.message}`)
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا العنصر؟')) return
    await fetch(`/api/admin/${resource}/${id}`, { method: 'DELETE' })
    await load()
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
    await fetch(`/api/admin/${resource}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map(i => i.id) }),
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: C.text1, marginBottom: 4 }}>{title}</h1>
          <p style={{ fontSize: 13, color: C.text3 }}>{description}</p>
        </div>
        <button onClick={() => setEditing({ ...emptyItem })} style={{ height: 40, padding: '0 18px', background: C.primary, color: W, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: "'Th',serif" }}>
          + إضافة جديد
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: 14, padding: '10px 16px', background: msg.startsWith('✓') ? C.secondaryBg : C.errorBg, borderRadius: 10, fontSize: 13, fontWeight: 700, color: msg.startsWith('✓') ? '#085041' : '#A32D2D' }}>
          {msg}
        </div>
      )}

      {editing && (
        <div style={{ background: W, border: `1px solid ${C.border}`, borderRadius: 18, padding: '22px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.text1, marginBottom: 16 }}>{editing.id ? 'تعديل العنصر' : 'إضافة عنصر جديد'}</div>
          <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {fields.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : undefined }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea rows={3} value={editing[f.key] ?? ''} onChange={e => setEditing((s: any) => ({ ...s, [f.key]: e.target.value }))} style={{ ...inp, resize: 'vertical' }} placeholder={f.placeholder} />
                ) : f.type === 'select' ? (
                  <select value={editing[f.key] ?? ''} onChange={e => setEditing((s: any) => ({ ...s, [f.key]: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                    {(f.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <div style={{ display: 'flex', alignItems: 'center', height: 40 }}>
                    <input type="checkbox" checked={!!editing[f.key]} onChange={e => setEditing((s: any) => ({ ...s, [f.key]: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  </div>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={editing[f.key] ?? ''}
                    onChange={e => setEditing((s: any) => ({ ...s, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                    style={inp}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={save} disabled={saving} style={{ height: 40, padding: '0 20px', background: C.primary, color: W, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: "'Th',serif" }}>
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setEditing(null)} style={{ height: 40, padding: '0 20px', background: '#fff', color: C.text3, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Th',serif" }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div style={{ background: W, border: `1px solid ${C.border}`, borderRadius: 18, padding: '6px 22px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.text3 }}>جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.text3 }}>لا توجد عناصر بعد</div>
        ) : items.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renderLabel(item)}</div>
              {renderMeta && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{renderMeta(item)}</div>}
            </div>
            {reorderable && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="نقل لأعلى" className="admin-icon-btn" style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.35 : 1 }}>↑</button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="نقل لأسفل" className="admin-icon-btn" style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', cursor: i === items.length - 1 ? 'default' : 'pointer', opacity: i === items.length - 1 ? 0.35 : 1 }}>↓</button>
              </div>
            )}
            <button onClick={() => setEditing(item)} style={{ height: 30, padding: '0 12px', background: C.primaryLight, color: C.primary, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Th',serif" }}>تعديل</button>
            <button onClick={() => remove(item.id)} style={{ height: 30, padding: '0 12px', background: '#FEF2F2', color: '#A32D2D', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Th',serif" }}>حذف</button>
          </div>
        ))}
      </div>
    </div>
  )
}
