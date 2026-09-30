import { v4 as uuidv4 } from 'uuid';

export const DEVICE_COOKIE = 'hz_device';
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDeviceId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id);
}

export function issueDeviceId(): string {
  return uuidv4();
}

export function deviceCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  };
}
