'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { card, cardTitle, inp, label as labelStyle, focus, blur, btnPrimary, PageHeader, LoadingBlock, useToast } from './adminUi'

interface SystemStatus {
  supabaseConnected: boolean
  paymentGateway: string
  paymentGatewayKeyConfigured: boolean
  emailConfigured: boolean
  appUrl: string
  schema?: { migrationRequired: boolean; missingTables: string[]; missingColumns: Record<string, string[]> }
}

export function AccountSettingsTab() {
  const toast = useToast()
  const [email, setEmail] = useState<string | null>(null)
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: userData }, statusRes] = await Promise.all([
        supabase.auth.getUser(),
        fetch('/api/admin/system-status'),
      ])
      const statusJson = await statusRes.json().catch(() => null)
      if (cancelled) return
      setEmail(userData.user?.email ?? null)
      if (statusRes.ok && statusJson?.data) setStatus(statusJson.data)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function changePassword() {
    if (pwd.length < 8) { toast.push('error', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    if (pwd !== pwd2) { toast.push('error', 'كلمتا المرور غير متطابقتين'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) throw error
      toast.push('success', 'تم تغيير كلمة المرور بنجاح')
      setPwd(''); setPwd2('')
    } catch (e: any) {
      toast.push('error', e.message ?? 'حدث خطأ أثناء تغيير كلمة المرور')
    }
    setSaving(false)
  }

  if (loading) return <div><PageHeader title="إعدادات الحساب" /><LoadingBlock /></div>

  return (
    <div>
      <PageHeader title="إعدادات الحساب" subtitle="بيانات حساب المشرف الخاص بك" />

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={cardTitle}>الحساب</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg,${C.primary},#8b6dd4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
            {email?.[0]?.toUpperCase() ?? 'م'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>المشرف</div>
            <div style={{ fontSize: 12, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email ?? '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={cardTitle}>تغيير كلمة المرور</div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>كلمة المرور الجديدة</label>
          <input type="password" dir="ltr" autoComplete="new-password" value={pwd} onFocus={focus} onBlur={blur} onChange={e => setPwd(e.target.value)} style={inp} placeholder="8 أحرف على الأقل" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>تأكيد كلمة المرور</label>
          <input type="password" dir="ltr" autoComplete="new-password" value={pwd2} onFocus={focus} onBlur={blur} onChange={e => setPwd2(e.target.value)} style={inp} placeholder="••••••••" />
        </div>
        <button onClick={changePassword} disabled={saving} style={btnPrimary(saving)}>
          {saving ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
        </button>
      </div>

      <div style={card}>
        <div style={cardTitle}>حالة النظام</div>
        {(() => {
          const rows = [
            { label: 'Supabase', ok: status?.supabaseConnected ?? false, status: status?.supabaseConnected ? '✓ متصل' : '✗ غير متصل' },
            { label: 'بوابة الدفع', ok: status?.paymentGatewayKeyConfigured ?? false, status: `${status?.paymentGateway ?? '—'} ${status?.paymentGatewayKeyConfigured ? '✓' : '✗ مفتاح مفقود'}` },
            { label: 'البريد الإلكتروني (Resend)', ok: status?.emailConfigured ?? false, status: status?.emailConfigured ? '✓ مُفعّل' : '✗ مفتاح API أو عنوان المرسل مفقود' },
            { label: 'مطابقة قاعدة البيانات', ok: status?.schema ? !status.schema.migrationRequired : false, status: !status?.schema ? '—' : status.schema.migrationRequired ? `✗ تحديث مطلوب (${status.schema.missingTables.length} جدول، ${Object.keys(status.schema.missingColumns).length} جدول به حقول ناقصة)` : '✓ محدّثة' },
            { label: 'رابط الموقع', ok: true, status: status?.appUrl ?? '—' },
          ]
          return rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: 13, color: C.text2 }}>{r.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.ok ? '#085041' : '#A32D2D', background: r.ok ? C.secondaryBg : C.errorBg, padding: '3px 10px', borderRadius: 999 }}>{r.status}</span>
            </div>
          ))
        })()}
      </div>
    </div>
  )
}
