const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('ADMIN_PASSWORD environment variable is not set');
  }
  return secret;
}

async function hmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifySyncKey(provided: string | null): boolean {
  const expected = process.env.SYNC_API_KEY;
  if (!expected || !provided) return false;
  return timingSafeEqual(provided, expected);
}

export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + SESSION_DURATION_MS;
  const payload = btoa(expiry.toString());
  const sig = await hmac(payload, getSecret());
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  try {
    const expiry = parseInt(atob(payload), 10);
    if (isNaN(expiry) || Date.now() > expiry) return false;
  } catch {
    return false;
  }

  const expected = await hmac(payload, secret);
  return timingSafeEqual(sig, expected);
}

export function verifyPassword(password: string): boolean {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }
  return timingSafeEqual(password, secret);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  };
}

export { SESSION_COOKIE };
