import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, getSessionCookieOptions, verifyPassword, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }

  const { password } = await request.json().catch(() => ({ password: '' }));

  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
  return response;
}
