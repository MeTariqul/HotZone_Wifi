import { NextRequest, NextResponse } from 'next/server';
import { getVoucher } from '@/lib/db';
import { normalizeCode } from '@/lib/voucher-code';
import { DEVICE_COOKIE, deviceCookieOptions, issueDeviceId, isValidDeviceId } from '@/lib/device';

function devicePayload(voucher: {
  code: string;
  plan_id: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  used: number;
}) {
  return {
    valid: true,
    code: voucher.code,
    plan: voucher.plan_id,
    duration: voucher.duration_seconds,
    download: voucher.download_kbps,
    upload: voucher.upload_kbps,
    reused: voucher.used === 1,
  };
}

function withDeviceCookie(response: NextResponse, request: NextRequest): string {
  const existing = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = isValidDeviceId(existing) ? existing : issueDeviceId();
  response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  return deviceId;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('code');
  if (!raw) {
    return NextResponse.json({ valid: false, error: 'code param required' }, { status: 400 });
  }

  const code = normalizeCode(raw);
  if (!code) {
    return NextResponse.json({ valid: false, error: 'Invalid code format' }, { status: 400 });
  }

  const voucher = await getVoucher(code);
  if (!voucher) {
    return NextResponse.json({ valid: false, error: 'Voucher not found' }, { status: 404 });
  }

  const response = NextResponse.json(devicePayload(voucher));
  withDeviceCookie(response, request);
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({ code: '' }));
  const code = normalizeCode(String(body.code || ''));
  if (!code) {
    return NextResponse.json({ valid: false, error: 'Invalid code format' }, { status: 400 });
  }

  const voucher = await getVoucher(code);
  if (!voucher) {
    return NextResponse.json({ valid: false, error: 'Voucher not found' }, { status: 404 });
  }

  const response = NextResponse.json(devicePayload(voucher));
  withDeviceCookie(response, request);
  return response;
}
