import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/db';

export async function GET() {
  const plans = getPlans();
  return NextResponse.json(plans);
}
