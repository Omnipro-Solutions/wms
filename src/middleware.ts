import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveWorkerRoute } from '@/lib/worker-routes'
import type { OperatorRole } from '@/lib/worker-routes'

const WORKER_ROLES: OperatorRole[] = ['picker', 'packer', 'receiver', 'driver']

export const middleware = (request: NextRequest) => {
  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/auth')
  const sessionCookie = request.cookies.get('wms-auth-session')
  const roleCookie = request.cookies.get('wms-operator-role')
  const role = roleCookie?.value as OperatorRole | undefined

  // Unauthenticated → login
  if (!isAuthRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Auth routes: pass through
  if (isAuthRoute) return NextResponse.next()

  // Worker roles trying to access desktop (app) routes → redirect to their worker route
  if (role && WORKER_ROLES.includes(role) && !pathname.startsWith('/worker')) {
    return NextResponse.redirect(new URL(resolveWorkerRoute(role), request.url))
  }

  // /worker hub → redirect to role route
  if (pathname === '/worker' && role) {
    return NextResponse.redirect(new URL(resolveWorkerRoute(role), request.url))
  }

  // Non-worker roles trying to access worker routes → redirect to desktop
  if (pathname.startsWith('/worker') && role && !WORKER_ROLES.includes(role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
