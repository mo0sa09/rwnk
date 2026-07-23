import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Server-only, never import from a client component.
export function getAdminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any
}
