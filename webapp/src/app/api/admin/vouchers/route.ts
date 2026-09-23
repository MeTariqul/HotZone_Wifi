import { NextRequest, NextResponse } from 'next/server';
import { createFreeVouchers, writeAudit } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { planId, count, note } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const vouchers = await createFreeVouchers(String(planId), count || 1, note);
    await writeAudit(
      'vouchers.generate',
      `plan=${planId} count=${vouchers.length}${note ? ` note=${note}` : ''}`
    );
    return NextResponse.json({ vouchers }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create vouchers';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
