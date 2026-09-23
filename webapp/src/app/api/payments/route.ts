import { NextRequest, NextResponse } from 'next/server';
import { createPayment, getPlan } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { planId, discountCode } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const plan = await getPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const payment = await createPayment(planId, discountCode);

    return NextResponse.json({
      paymentId: payment.id,
      plan: plan.name,
      amount: payment.amount_bdt,
      originalAmount: payment.original_amount_bdt ?? plan.price_bdt,
      discountCode: payment.discount_code,
      status: 'pending',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    if (msg.includes('discount code')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
