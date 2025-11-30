import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    // landing origin to proxy pages/assets to
    const LANDING_ORIGIN = 'https://fragola-sdk-landing.vercel.app'

    // Helper: is this request for an asset or Next internals?
    const isAssetRequest = pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.includes('.')

    // Read cookie that indicates what origin served the main HTML
    const servedBy = request.cookies.get('served_by')?.value ?? null

    // If this is an asset request, decide whether to serve from landing
    // origin or locally based on the `served_by` cookie set when the
    // main HTML was rewritten.
    if (isAssetRequest) {
        if (servedBy === 'landing') {
            const url = request.nextUrl.clone()
            const destination = new URL(pathname, LANDING_ORIGIN)
            destination.search = url.search
            return NextResponse.rewrite(destination)
        }

        // served_by is 'main' or unset -> serve asset locally
        return NextResponse.next()
    }

    // Keep API and docs routes local
    if (pathname.startsWith('/docs') || pathname.startsWith('/api')) {
        // mark served_by=main so subsequent assets load locally
        const res = NextResponse.next()
        res.cookies.set('served_by', 'main', { path: '/' })
        return res
    }

    // For page navigation (paths without extension) rewrite to landing
    // origin but set a cookie so we know to fetch assets from that origin
    const url = request.nextUrl.clone()
    const destination = new URL(pathname, LANDING_ORIGIN)
    destination.search = url.search

    const res = NextResponse.rewrite(destination)
    // tell the browser that the HTML was served by the landing origin so
    // subsequent `/_next` requests can be rewritten to the landing origin
    res.cookies.set('served_by', 'landing', { path: '/' })
    return res
}

export const config = {
    matcher: [
        '/:path*',
    ],
}
