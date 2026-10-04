import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { resolveAdminRole } from './lib/admin-roles'

const PROTECTED_USER  = ['/library', '/account']
const PROTECTED_ADMIN = ['/admin']
// Public on purpose — this is where someone with NO account yet lands from
// an invitation email. Gating it behind the admin-login redirect below
// would make it impossible to ever accept an invite.
const PUBLIC_ADMIN_PATHS = ['/admin/invite']

// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (and the
// exported `middleware` function to `proxy`) — this file MUST keep this name
// and export name or it silently never runs, leaving every route below
// unprotected. See node_modules/next/dist/docs/.../upgrading/version-16.md.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isUserRoute  = PROTECTED_USER.some(p  => pathname.startsWith(p))
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(p => pathname.startsWith(p))
  const isAdminRoute = !isPublicAdminPath && PROTECTED_ADMIN.some(p => pathname.startsWith(p))

  if (!isUserRoute && !isAdminRoute) return NextResponse.next({ request })

  // Writing refreshed cookies to `response` alone sends them to the browser
  // but leaves `request.cookies` stale for the rest of THIS request — any
  // Server Component rendered after this proxy call would still read the
  // old (possibly expired) access token via next/headers' cookies(). Per
  // Supabase's own documented Next.js middleware recipe, `setAll` must also
  // update `request.cookies` and the response must be re-created from that
  // updated request so the refresh is visible downstream, not just to the
  // browser on the next request.
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → login
  if (!user && (isUserRoute || isAdminRoute)) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Admin route — role is resolved from the admin_users table (service-role
  // read), the same trusted source /api/admin/* routes use via
  // requireAdmin() — see src/lib/admin-roles.ts for why user_metadata.role
  // is no longer part of this check (it's client-writable).
  if (isAdminRoute && user) {
    const role = await resolveAdminRole(user)
    if (!role) return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-icon.png|api|robots|sitemap).*)'],
}
