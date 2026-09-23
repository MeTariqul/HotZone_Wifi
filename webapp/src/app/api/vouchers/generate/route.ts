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
      success: true,
      voucher: {
        code: result.voucher.code,
        plan: result.voucher.plan_id,
        duration: result.voucher.duration_seconds,
        download: result.voucher.download_kbps,
        upload: result.voucher.upload_kbps,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate voucher';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
