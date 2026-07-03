import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_USER  = ['/library', '/account']
const PROTECTED_ADMIN = ['/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const isUserRoute  = PROTECTED_USER.some(p  => pathname.startsWith(p))
  const isAdminRoute = PROTECTED_ADMIN.some(p => pathname.startsWith(p))

  if (!isUserRoute && !isAdminRoute) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        ),
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

  // Admin route — check admin role in user metadata
  if (isAdminRoute && user) {
    const isAdmin =
      user.email === process.env.ADMIN_EMAIL ||
      user.user_metadata?.role === 'admin' ||
      user.app_metadata?.role === 'admin'

    if (!isAdmin) return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-icon.png|api|robots|sitemap).*)'],
}
