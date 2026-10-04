import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { isMissingTableError, missingTableMessage } from '@/lib/db-resilience'

// Any active admin role can VIEW the staff list (viewing isn't the
// sensitive part — inviting/removing/changing roles is, and those routes
// each independently require ['super_admin']). Hiding this tab/button from
// non-super-admins in the UI is cosmetic; this server-side check is the
// actual boundary.
export async function GET(request: NextRequest) {
  const { role, error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const sb = getAdminDb()

  const { data: staff, error: staffErr } = await sb.from('admin_users').select('*').order('created_at', { ascending: true })
  if (staffErr) {
    if (isMissingTableError(staffErr)) {
      console.error('[admin/staff] admin_users table does not exist — pending migration in supabase/schema.sql §19 has not been applied.')
      return NextResponse.json({ data: { currentRole: role, staff: [], invitations: [] }, migrationRequired: true, error: missingTableMessage('admin_users') })
    }
    console.error(`[admin/staff] failed to load admin_users: ${staffErr.message}`)
    return NextResponse.json({ error: staffErr.message }, { status: 500 })
  }

  const { data: invitations, error: invErr } = await sb.from('admin_invitations')
    .select('id,email,name,role,expires_at,created_at,invited_by,revoked_at,accepted_at')
    .is('accepted_at', null).is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (invErr && !isMissingTableError(invErr)) {
    console.error(`[admin/staff] failed to load admin_invitations: ${invErr.message}`)
  }

  // last_sign_in_at only exists on the Auth user record, not admin_users —
  // one listUsers() call (bounded to 20 pages, same pattern as
  // ensureUserLinked/set-password) rather than N round-trips per staff row.
  const lastSignIn: Record<string, string | null> = {}
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) lastSignIn[u.id] = u.last_sign_in_at ?? null
    if (data.users.length < 1000) break
  }

  const staffWithSignIn = (staff ?? []).map((s: any) => ({ ...s, last_sign_in_at: lastSignIn[s.id] ?? null }))

  return NextResponse.json({ data: { currentRole: role, staff: staffWithSignIn, invitations: invitations ?? [] } })
}
