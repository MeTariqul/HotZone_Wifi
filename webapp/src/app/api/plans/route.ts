import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/db';

export async function GET() {
  const plans = await getPlans();
  return NextResponse.json(plans);
}
