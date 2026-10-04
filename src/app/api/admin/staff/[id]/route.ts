import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

const ASSIGNABLE_ROLES = new Set(['admin', 'staff'])

// Shared guard for both handlers below: only super_admin may touch another
// admin_users row, the target must exist, and the target can never be a
// super_admin row (there is exactly one — the owner — and neither this
// route nor the UI ever offers 'super_admin' as an assignable role, so the
// only way a row could have it is the owner's own bootstrapped row). This
// is what "the primary owner must never accidentally lose admin access"
// and "Admin cannot change the super-admin account" mean in code — not just
// a UI restriction, every write here is rejected server-side regardless of
// what the client sends.
async function loadGuardedTarget(sb: any, id: string, requestingUserId: string) {
  if (id === requestingUserId) {
    return { error: NextResponse.json({ error: 'لا يمكنك تعديل صلاحيتك الخاصة' }, { status: 403 }) }
  }
  const { data: target, error } = await sb.from('admin_users').select('id,role').eq('id', id).maybeSingle()
  if (error || !target) {
    return { error: NextResponse.json({ error: 'المشرف غير موجود' }, { status: 404 }) }
  }
  if (target.role === 'super_admin') {
    return { error: NextResponse.json({ error: 'لا يمكن تعديل حساب المالك الرئيسي' }, { status: 403 }) }
  }
  return { target, error: null }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authErr } = await requireAdmin(request, ['super_admin'])
  if (authErr) return authErr

  const sb = getAdminDb()
  const guard = await loadGuardedTarget(sb, id, user!.id)
  if (guard.error) return guard.error

  const body = await request.json().catch(() => null)
  const patch: Record<string, unknown> = {}
  if (body?.role !== undefined) {
    if (!ASSIGNABLE_ROLES.has(body.role)) {
      return NextResponse.json({ error: 'الصلاحية يجب أن تكون admin أو staff' }, { status: 400 })
    }
    patch.role = body.role
  }
  if (body?.is_active !== undefined) {
    patch.is_active = !!body.is_active
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'لا يوجد تغيير' }, { status: 400 })
  }

  const { data, error } = await sb.from('admin_users').update(patch).eq('id', id).select().single()
  if (error) {
    console.error(`[admin/staff/${id}] update failed: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[admin/staff/${id}] updated by ${user!.id} — fields=${Object.keys(patch).join(',')}`)
  return NextResponse.json({ data })
}

// Revokes dashboard access by deleting the admin_users row — the NEXT
// requireAdmin()/resolveAdminRole() lookup for this person finds no row and
// denies access immediately (§9/§6 of the spec: "Revoked staff →
// immediately loses admin access"). This deliberately does NOT delete the
// underlying Supabase Auth user — they may still be a legitimate customer
// (or simply shouldn't have their login destroyed over a dashboard
// permission change); only their admin access is revoked.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authErr } = await requireAdmin(request, ['super_admin'])
  if (authErr) return authErr

  const sb = getAdminDb()
  const guard = await loadGuardedTarget(sb, id, user!.id)
  if (guard.error) return guard.error

  const { error } = await sb.from('admin_users').delete().eq('id', id)
  if (error) {
    console.error(`[admin/staff/${id}] delete failed: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[admin/staff/${id}] access revoked by ${user!.id}`)
  return NextResponse.json({ ok: true })
}
