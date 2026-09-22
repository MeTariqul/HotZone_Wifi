import { NextRequest, NextResponse } from 'next/server';
import { completePayment } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

    const result = await completePayment(paymentId);

    return NextResponse.json({
      voucherCode: result.voucher.code,
      plan: result.voucher.plan_id,
      duration: result.voucher.duration_seconds,
      message: 'Payment completed. Use this voucher code on the WiFi splash page.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 });
  }
}
