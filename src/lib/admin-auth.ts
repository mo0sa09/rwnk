import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { resolveAdminRole, type AdminRole } from './admin-roles'

export interface RequireAdminResult {
  user: User | null
  role: AdminRole | null
  error: NextResponse | null
}

// Mirrors the admin check in src/proxy.ts — both call resolveAdminRole()
// (src/lib/admin-roles.ts) so there is exactly one place the actual "who is
// an admin" decision is made, kept in one place so every /api/admin/*
// route agrees on who counts as an admin.
//
// `allowedRoles`, when given, additionally requires the resolved role to be
// one of them — e.g. staff-management endpoints pass ['super_admin']. Omit
// it to allow any active admin role through (every pre-existing /api/admin/*
// route's behavior, unchanged).
export async function requireAdmin(request: NextRequest, allowedRoles?: AdminRole[]): Promise<RequireAdminResult> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, role: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = await resolveAdminRole(user)
  if (!role) {
    return { user: null, role: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    return { user: null, role: null, error: NextResponse.json({ error: 'Forbidden — insufficient role' }, { status: 403 }) }
  }

  return { user, role, error: null }
}
