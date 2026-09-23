import { NextRequest, NextResponse } from 'next/server';
import { getVoucher } from '@/lib/db';

const CODE_RE = /^[A-Z0-9-]{4,32}$/;

function normalizeCode(raw: string): string | null {
  const code = raw.toUpperCase().trim();
  return CODE_RE.test(code) ? code : null;
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
  if (voucher.used) {
    return NextResponse.json({ valid: false, error: 'Voucher already used' }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    code: voucher.code,
    plan: voucher.plan_id,
    duration: voucher.duration_seconds,
    download: voucher.download_kbps,
    upload: voucher.upload_kbps,
  });
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
  if (voucher.used) {
    return NextResponse.json({ valid: false, error: 'Voucher already used' }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    code: voucher.code,
    plan: voucher.plan_id,
    duration: voucher.duration_seconds,
    download: voucher.download_kbps,
    upload: voucher.upload_kbps,
  });
}
