import { NextRequest, NextResponse } from 'next/server';
import { listDiscountCodes, createDiscountCode, deactivateDiscountCode } from '@/lib/db';

export async function GET() {
  try {
    const codes = await listDiscountCodes();
    return NextResponse.json({ codes });
  } catch {
    return NextResponse.json({ error: 'Failed to list discount codes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, type, value, plan_id, max_uses, expires_at } = body;

    if (!type || !['percent', 'fixed', 'free'].includes(type)) {
      return NextResponse.json({ error: 'type must be percent, fixed, or free' }, { status: 400 });
    }
    if (value === undefined || value === null || typeof value !== 'number') {
      return NextResponse.json({ error: 'value must be a number' }, { status: 400 });
    }

    const created = await createDiscountCode({
      code,
      type,
      value,
      plan_id: plan_id || null,
      max_uses,
      expires_at: expires_at || null,
    });
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create discount code';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }
    const ok = await deactivateDiscountCode(String(code).trim().toUpperCase());
    if (!ok) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 });
  }
}
