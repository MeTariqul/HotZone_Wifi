import { NextRequest, NextResponse } from 'next/server';
import { getVoucher } from '@/lib/db';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ valid: false, error: 'code param required' }, { status: 400 });
  }

  const voucher = getVoucher(code.toUpperCase().trim());
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
  const { code } = await request.json();
  if (!code) {
    return NextResponse.json({ valid: false, error: 'code is required' }, { status: 400 });
  }

  const voucher = getVoucher(code.toUpperCase().trim());
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
