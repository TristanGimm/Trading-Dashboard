import { NextResponse, type NextRequest } from 'next/server';
import { readSessionClaims, readSessionSecret, safeDashboardRedirect, SESSION_COOKIE } from './lib/auth-crypto';

// Fast pre-check only: signature and expiry, no database. The server layer
// still resolves the account and compares its session version before any data
// is read, so a revoked session never reaches a page.
export function proxy(request: NextRequest) {
  if (readSessionClaims(request.cookies.get(SESSION_COOKIE)?.value, readSessionSecret())) return NextResponse.next();
  const destination = new URL('/login', request.url);
  destination.searchParams.set('next', safeDashboardRedirect(request.nextUrl.pathname + request.nextUrl.search));
  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/workspace/:path*', '/journal/:path*', '/strategy/:path*',
    '/calendar/:path*', '/analytics/:path*',
  ],
};
