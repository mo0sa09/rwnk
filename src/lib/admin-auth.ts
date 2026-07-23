import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

// Mirrors the admin check in src/proxy.ts — kept in one place so
// every /api/admin/* route agrees on who counts as an admin.
export async function requireAdmin(request: NextRequest): Promise<{ user: User | null; error: NextResponse | null }> {
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
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const isAdmin =
    user.email === process.env.ADMIN_EMAIL ||
    user.user_metadata?.role === 'admin' ||
    user.app_metadata?.role === 'admin'

  if (!isAdmin) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, error: null }
}
