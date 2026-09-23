import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

const PUBLIC_API = new Set([
  '/api/plans',
  '/api/payments',
  '/api/vouchers/verify',
  '/api/vouchers/sync',
  '/api/vouchers/generate',
  '/api/vouchers/authorize',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/check',
  '/api/discount-codes/validate',
  '/api/router/sync',
]);

const PROTECTED_PREFIXES = ['/api/vouchers', '/api/router', '/api/admin'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionToken(token);

  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
