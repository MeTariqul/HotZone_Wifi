import { NextRequest, NextResponse } from 'next/server';
import { createPayment, getPlan } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const plan = getPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const payment = createPayment(planId);

    return NextResponse.json({
      paymentId: payment.id,
      plan: plan.name,
      amount: plan.price_bdt,
      status: 'pending',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
