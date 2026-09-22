import { NextRequest, NextResponse } from 'next/server';
import { completePayment } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

    const result = completePayment(paymentId);

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate voucher' }, { status: 400 });
  }
}
