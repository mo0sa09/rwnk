// Every server route that needs the service-role Supabase client reads these
// two vars and 500s with a generic "service misconfigured" message if either
// is missing. .env.local only feeds `next dev`/`next build` on THIS machine —
// it is gitignored and never reaches a deployment host. If these are unset in
// production it's because they were never added to the hosting platform's own
// environment variable settings (e.g. Vercel Project Settings → Environment
// Variables), not because of a code bug. This logs exactly which var is
// missing server-side (visible in the host's function logs) so that's fast
// to diagnose without exposing anything to the client response.
export function getSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean)
    console.error(
      `[env] Missing required server environment variable(s): ${missing.join(', ')}. ` +
      `Set them in the hosting platform's environment variable settings — .env.local is not deployed.`
    )
  }
  return { url, key }
}
