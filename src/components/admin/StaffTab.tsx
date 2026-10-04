'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { IconPlus, IconMailForward, IconBan, IconCheck } from '@tabler/icons-react'
import { card, cardTitle, inp, label as labelStyle, focus, blur, btnPrimary, PageHeader, LoadingBlock, EmptyState, useToast, useConfirm } from './adminUi'

type AdminRole = 'super_admin' | 'admin' | 'staff'

interface StaffMember {
  id: string
  email: string
  full_name: string | null
  role: AdminRole
  is_active: boolean
  created_at: string
  last_sign_in_at: string | null
}

interface Invitation {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'staff'
  expires_at: string
  created_at: string
}

interface InviteForm {
  email: string
  name: string
  role: 'admin' | 'staff'
}

const EMPTY_INVITE: InviteForm = { email: '', name: '', role: 'staff' }
const ROLE_LABEL: Record<AdminRole, string> = { super_admin: 'مالك رئيسي', admin: 'مشرف', staff: 'عضو فريق' }

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('ar-KW', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return iso }
}

export function StaffTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const [currentRole, setCurrentRole] = useState<AdminRole | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [migrationError, setMigrationError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState<InviteForm>({ ...EMPTY_INVITE })
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const isSuperAdmin = currentRole === 'super_admin'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/staff')
        const json = await res.json()
        if (cancelled) return
        setCurrentRole(json.data?.currentRole ?? null)
        setStaff(json.data?.staff ?? [])
        setInvitations(json.data?.invitations ?? [])
        setMigrationError(json.migrationRequired ? json.error : null)
      } catch { /* keep previous state on transient failure */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function load() {
    try {
      const res = await fetch('/api/admin/staff')
      const json = await res.json()
      setCurrentRole(json.data?.currentRole ?? null)
      setStaff(json.data?.staff ?? [])
      setInvitations(json.data?.invitations ?? [])
      setMigrationError(json.migrationRequired ? json.error : null)
    } catch { /* keep previous state on transient failure */ }
  }

  async function sendInvite() {
    if (!inviteForm.email.trim()) { toast.push('error', 'البريد الإلكتروني مطلوب'); return }
    setInviting(true)
    try {
      const res = await fetch('/api/admin/staff/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteForm.email.trim(), name: inviteForm.name.trim() || undefined, role: inviteForm.role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ')
      toast.push('success', json.emailSent ? 'تم إرسال الدعوة بنجاح' : 'تم إنشاء الدعوة، لكن تعذّر إرسال البريد — تحققي من إعدادات Resend')
      setShowInvite(false)
      setInviteForm({ ...EMPTY_INVITE })
      await load()
    } catch (e: any) {
      toast.push('error', e.message ?? 'حدث خطأ')
    }
    setInviting(false)
  }

  async function changeRole(member: StaffMember, role: 'admin' | 'staff') {
    setBusyId(member.id)
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
      toast.push('success', 'تم تغيير الصلاحية')
    } catch (e: any) {
      toast.push('error', e.message ?? 'تعذّر تغيير الصلاحية')
    }
    setBusyId(null)
    await load()
  }

  async function toggleActive(member: StaffMember) {
    setBusyId(member.id)
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !member.is_active }) })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
      toast.push('success', member.is_active ? 'تم إيقاف الوصول' : 'تم تفعيل الوصول')
    } catch (e: any) {
      toast.push('error', e.message ?? 'تعذّر تحديث الحالة')
    }
    setBusyId(null)
    await load()
  }

  function removeStaff(member: StaffMember) {
    confirm.ask(`إلغاء وصول "${member.full_name || member.email}" نهائياً؟ سيفقد الدخول إلى لوحة التحكم فوراً.`, async () => {
      setBusyId(member.id)
      try {
        const res = await fetch(`/api/admin/staff/${member.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
        toast.push('success', 'تم إلغاء الوصول')
      } catch (e: any) {
        toast.push('error', e.message ?? 'تعذّر إلغاء الوصول')
      }
      setBusyId(null)
      await load()
    })
  }

  async function resendInvite(inv: Invitation) {
    setBusyId(inv.id)
    try {
      const res = await fetch(`/api/admin/staff/invitations/${inv.id}/resend`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
      toast.push('success', json.emailSent ? 'تم إعادة إرسال الدعوة' : 'تم تجديد الدعوة، لكن تعذّر إرسال البريد')
    } catch (e: any) {
      toast.push('error', e.message ?? 'تعذّر إعادة إرسال الدعوة')
    }
    setBusyId(null)
    await load()
  }

  function cancelInvite(inv: Invitation) {
    confirm.ask(`إلغاء الدعوة المرسلة إلى "${inv.email}"؟`, async () => {
      setBusyId(inv.id)
      try {
        const res = await fetch(`/api/admin/staff/invitations/${inv.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error ?? 'حدث خطأ')
        toast.push('success', 'تم إلغاء الدعوة')
      } catch (e: any) {
        toast.push('error', e.message ?? 'تعذّر إلغاء الدعوة')
      }
      setBusyId(null)
      await load()
    })
  }

  if (loading) return <div><PageHeader title="المشرفين" /><LoadingBlock /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <PageHeader title="المشرفين" subtitle="إدارة فريق لوحة التحكم ودعوة أعضاء جدد" />
        {isSuperAdmin && (
          <button onClick={() => setShowInvite(true)} disabled={!!migrationError} style={{ height: 40, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 6, background: migrationError ? C.surface : C.primary, color: migrationError ? C.text3 : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: migrationError ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            <IconPlus size={15} /> دعوة مشرف
          </button>
        )}
      </div>

      {migrationError && (
        <div style={{ marginBottom: 14, padding: '10px 16px', background: '#FFF7E6', border: '1px solid #F5C453', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#7A5300' }}>
          {migrationError}
        </div>
      )}

      {showInvite && isSuperAdmin && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={cardTitle}>دعوة مشرف جديد</div>
          <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>البريد الإلكتروني</label>
              <input type="email" dir="ltr" value={inviteForm.email} onFocus={focus} onBlur={blur} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" style={{ ...inp, textAlign: 'left' }} />
            </div>
            <div>
              <label style={labelStyle}>الاسم (اختياري)</label>
              <input value={inviteForm.name} onFocus={focus} onBlur={blur} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={labelStyle}>الصلاحية</label>
              <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as 'admin' | 'staff' }))} onFocus={focus as any} onBlur={blur as any} style={{ ...inp, cursor: 'pointer' }}>
                <option value="staff">عضو فريق (staff)</option>
                <option value="admin">مشرف (admin)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={sendInvite} disabled={inviting} style={btnPrimary(inviting)}>{inviting ? 'جاري الإرسال...' : 'إرسال الدعوة'}</button>
            <button onClick={() => { setShowInvite(false); setInviteForm({ ...EMPTY_INVITE }) }} style={{ height: 46, padding: '0 20px', background: '#fff', color: C.text3, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء</button>
          </div>
        </div>
      )}

      {invitations.length > 0 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={cardTitle}>دعوات معلّقة</div>
          {invitations.map((inv, i) => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.text1 }}>{inv.name || inv.email}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>{inv.email} · {ROLE_LABEL[inv.role]} · تنتهي {formatDate(inv.expires_at)}</div>
              </div>
              {isSuperAdmin && (
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button disabled={busyId === inv.id} onClick={() => resendInvite(inv)} style={{ height: 30, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, background: C.primaryLight, color: C.primary, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <IconMailForward size={13} /> إعادة إرسال
                  </button>
                  <button disabled={busyId === inv.id} onClick={() => cancelInvite(inv)} style={{ height: 30, padding: '0 10px', background: '#FEF2F2', color: '#A32D2D', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء الدعوة</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, padding: '6px 22px' }}>
        {staff.length === 0 ? <EmptyState text="لا يوجد مشرفون بعد" /> : staff.map((member, i) => (
          <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: C.text1 }}>{member.full_name || member.email}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: member.role === 'super_admin' ? '#F7F5FE' : C.surface, color: member.role === 'super_admin' ? C.primary : C.text2 }}>{ROLE_LABEL[member.role]}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: member.is_active ? '#E1F5EE' : '#FEF2F2', color: member.is_active ? '#085041' : '#A32D2D' }}>{member.is_active ? 'فعال' : 'موقوف'}</span>
              </div>
              <div style={{ fontSize: 11, color: C.text3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ direction: 'ltr' }}>{member.email}</span>
                <span>· أُضيف {formatDate(member.created_at)}</span>
                <span>· آخر دخول {formatDate(member.last_sign_in_at)}</span>
              </div>
            </div>
            {isSuperAdmin && member.role !== 'super_admin' && (
              <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={member.role} disabled={busyId === member.id}
                  onChange={e => changeRole(member, e.target.value as 'admin' | 'staff')}
                  style={{ height: 30, borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '0 8px' }}
                >
                  <option value="staff">عضو فريق</option>
                  <option value="admin">مشرف</option>
                </select>
                <button disabled={busyId === member.id} onClick={() => toggleActive(member)} style={{ height: 30, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, background: member.is_active ? C.surface : C.primaryLight, color: member.is_active ? C.text3 : C.primary, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {member.is_active ? <IconBan size={13} /> : <IconCheck size={13} />} {member.is_active ? 'إيقاف الوصول' : 'تفعيل'}
                </button>
                <button disabled={busyId === member.id} onClick={() => removeStaff(member)} style={{ height: 30, padding: '0 10px', background: '#FEF2F2', color: '#A32D2D', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>حذف</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
