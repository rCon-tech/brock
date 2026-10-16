import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Cheap gate: no session cookie, no private pages. The real check (a valid session and an actual
 * membership) happens on the server in each page and route.
 */
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/h/:path*', '/new', '/settings', '/onboarding'],
};
