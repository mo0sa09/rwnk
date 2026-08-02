'use client'
import { useEffect, useState } from 'react'

interface SchemaAudit {
  reachable: boolean
  missingTables: string[]
  missingColumns: Record<string, string[]>
  migrationRequired: boolean
  error?: string
}

// Surfaces the single most consequential fact about this deployment's
// health right at the top of every admin tab: whether the database still
// needs supabase/schema.sql applied. Before this existed, a missing column
// only showed up as a specific save silently failing (or, for whole missing
// tables, an empty CRUD list) — nothing tied those symptoms back to "run the
// migration." This makes that connection impossible to miss.
export function SchemaStatusBanner() {
  const [schema, setSchema] = useState<SchemaAudit | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [checking, setChecking] = useState(false)

  // cache: 'no-store' on top of the route handler's own force-dynamic +
  // Cache-Control: no-store (see /api/admin/system-status) — this is a
  // live diagnostic, so nothing between the database and this component is
  // allowed to serve a stale answer (a browser back/forward cache hit here
  // would otherwise keep showing "migration required" for a migration that
  // already ran).
  async function check() {
    setChecking(true)
    try {
      const res = await fetch('/api/admin/system-status', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.data?.schema) setSchema(json.data.schema)
    } catch {}
    setChecking(false)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setChecking(true)
      try {
        const res = await fetch('/api/admin/system-status', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!cancelled && res.ok && json?.data?.schema) setSchema(json.data.schema)
      } catch {}
      if (!cancelled) setChecking(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (!schema || dismissed) return null
  if (!schema.reachable) {
    return (
      <div style={{ background: '#A32D2D', color: '#fff', padding: '10px 20px', borderRadius: 14, marginBottom: 20, fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span>تعذّر الاتصال بقاعدة البيانات لفحص الجداول{schema.error ? ` — ${schema.error}` : ''}</span>
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
    )
  }
  if (!schema.migrationRequired) return null

  const missingColumnEntries = Object.entries(schema.missingColumns)
  const totalMissingColumns = missingColumnEntries.reduce((n, [, cols]) => n + cols.length, 0)

  return (
    <div style={{ background: '#FFF7E6', border: '1px solid #F5C453', borderRadius: 14, marginBottom: 20, color: '#7A5300' }}>
      <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          ⚠ قاعدة البيانات تحتاج تحديث — {schema.missingTables.length > 0 && `${schema.missingTables.length} جدول مفقود`}
          {schema.missingTables.length > 0 && missingColumnEntries.length > 0 && '، '}
          {missingColumnEntries.length > 0 && `${totalMissingColumns} حقل مفقود في ${missingColumnEntries.length} جدول`}
          {' '}— بعض التعديلات من لوحة التحكم لن تُحفظ حتى يتم تشغيل التحديث في Supabase SQL Editor (ملف supabase/schema.sql).
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={check} disabled={checking} style={{ background: 'none', border: '1px solid #F5C453', color: '#7A5300', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: checking ? 'wait' : 'pointer' }}>
            {checking ? 'جاري الفحص...' : '↻ تحقق الآن'}
          </button>
          <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: '1px solid #F5C453', color: '#7A5300', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </button>
          <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: '#7A5300', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 20px 14px', fontSize: 12, lineHeight: 1.8 }}>
          {schema.missingTables.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong>جداول غير موجودة بالكامل:</strong> {schema.missingTables.join(', ')}
            </div>
          )}
          {missingColumnEntries.map(([table, cols]) => (
            <div key={table}><strong>{table}:</strong> {cols.join(', ')}</div>
          ))}
        </div>
      )}
    </div>
  )
}
