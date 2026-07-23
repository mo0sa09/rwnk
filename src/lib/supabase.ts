import { createBrowserClient } from '@supabase/ssr'

// Cookie-backed client (not localStorage) so the session is visible to
// middleware.ts and server components too — required for route protection
// and for the session to actually persist across a refresh consistently.
export function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  )
}

export const supabase = getSupabase()
