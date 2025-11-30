import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

//   // Check if the request is for the docs app itself
//   // We exclude:
//   // - /docs (the main docs route)
//   // - /api (API routes)
//   // - /_next (Next.js internals)
//   // - /static (static files)
//   // - files with extensions (e.g. robots.txt, images)
//   // Keep requests for the docs app and API routes local
  if (pathname.startsWith('/docs') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Allow Next.js internals and static asset requests (including
  // `/_next/image` optimizer requests and files with extensions) to pass
  // through the middleware unchanged so the image optimizer can handle
  // them and local/static assets are served normally.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // For everything else (e.g. the root path '/'), rewrite to the landing page
  // to preserve the original URL in the browser while serving the landing
  // content. We keep rewrite here as requested.
  const url = request.nextUrl.clone()
  const destination = new URL(pathname, 'https://fragola-sdk-landing.vercel.app')
  destination.search = url.search

  return NextResponse.rewrite(destination)
}

export const config = {
  matcher: [
    '/:path*',
  ],
}
