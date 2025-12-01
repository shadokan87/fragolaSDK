import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const referer = request.headers.get('referer') ?? request.headers.get('referrer');
  if (!referer) return NextResponse.next();

  let refPath = '';
  try {
    refPath = new URL(referer).pathname;
  } catch (e) {
    return NextResponse.next();
  }

  if (!refPath.includes('/docs')) {
    const dest = new URL(
      `https://fragola-sdk-landing.vercel.app${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.rewrite(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*'
};
