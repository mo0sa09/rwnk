import { createClient } from '@supabase/supabase-js'

export type AdminRole = 'super_admin' | 'admin' | 'staff'

export const ROLE_RANK: Record<AdminRole, number> = { staff: 0, admin: 1, super_admin: 2 }

interface AdminIdentity {
  id: string
  email?: string | null
  app_metadata?: Record<string, unknown> | null
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any
}

function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === 'PGRST205'
}

// The ONLY legacy signal still trusted, and only as a one-time bootstrap
// (see resolveAdminRole below) — never as an ongoing access check.
// user_metadata.role is deliberately NOT here: it's client-writable via
// supabase.auth.updateUser(), unlike app_metadata (admin-API-only) and the
// ADMIN_EMAIL env var (server-only config).
function isLegacyAdmin(user: AdminIdentity): boolean {
  return user.email === process.env.ADMIN_EMAIL || user.app_metadata?.role === 'admin'
}

// Single source of truth for "is this Supabase Auth user an active admin,
// and what role" — used by BOTH src/proxy.ts (Edge middleware, page-level
// gate) and src/lib/admin-auth.ts's requireAdmin() (API-route gate), so the
// two layers can never disagree about who counts as an admin.
//
// Trusts ONLY the admin_users table (service-role read, bypasses RLS). The
// ONE exception: while that table has zero rows at all (fresh migration,
// or not yet applied), a user matching the pre-existing ADMIN_EMAIL/
// app_metadata signal is bootstrapped in as super_admin — see supabase/
// schema.sql §19.3 for the migration-time equivalent of this. Once any row
// exists, "this user has no row" simply means they are not an admin.
export async function resolveAdminRole(user: AdminIdentity): Promise<AdminRole | null> {
  const sb = getServiceClient()

  const { data, error } = await sb.from('admin_users').select('role,is_active').eq('id', user.id).maybeSingle()

  if (error && isMissingTable(error)) {
    console.error('[admin-roles] admin_users table not found — the migration in supabase/schema.sql §19 has not been run yet. Falling back to the legacy ADMIN_EMAIL/app_metadata check so the owner is never locked out. RUN THE MIGRATION.')
    return isLegacyAdmin(user) ? 'super_admin' : null
  }
  if (error) {
    console.error(`[admin-roles] admin_users lookup failed for ${user.id}: ${error.message}`)
    return null
  }
  if (data) return data.is_active ? (data.role as AdminRole) : null

  const { count, error: countErr } = await sb.from('admin_users').select('id', { count: 'exact', head: true })
  if (countErr) {
    console.error(`[admin-roles] could not check admin_users row count: ${countErr.message}`)
    return null
  }
  if ((count ?? 0) > 0) return null
  if (!isLegacyAdmin(user)) return null

  const { data: inserted, error: insertErr } = await sb.from('admin_users')
    .insert({ id: user.id, email: user.email ?? '', role: 'super_admin', is_active: true })
    .select('role,is_active').single()
  if (!insertErr) {
    console.log(`[admin-roles] bootstrapped ${user.email} as super_admin (admin_users was empty, matched the legacy ADMIN_EMAIL/app_metadata check)`)
    return inserted.role as AdminRole
  }
  // Lost a race against a concurrent bootstrap attempt for the same user.
  const retry = await sb.from('admin_users').select('role,is_active').eq('id', user.id).maybeSingle()
  return retry.data?.is_active ? (retry.data.role as AdminRole) : null
}
