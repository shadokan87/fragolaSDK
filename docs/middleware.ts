import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the request is for the docs app itself
  // We exclude:
  // - /docs (the main docs route)
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /static (static files)
  // - files with extensions (e.g. robots.txt, images)
  if (
    pathname.startsWith('/docs') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // For everything else (e.g. the root path '/'), rewrite to the landing page
  const url = request.nextUrl.clone()
  const destination = new URL(pathname, 'https://fragola-sdk-landing.vercel.app')
  destination.search = url.search

  return NextResponse.rewrite(destination)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
