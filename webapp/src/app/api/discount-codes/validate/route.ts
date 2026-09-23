import { NextRequest, NextResponse } from 'next/server';
import { validateDiscountCode } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { code, planId } = await request.json();

    if (!code || !planId) {
      return NextResponse.json({ valid: false, error: 'code and planId are required' }, { status: 400 });
    }

    const result = await validateDiscountCode(String(code), String(planId));
    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch {
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
