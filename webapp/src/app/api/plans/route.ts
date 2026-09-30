import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/db';

export async function GET() {
  const plans = await getPlans();
  const response = NextResponse.json(plans);
  // Public catalog — allows the captive-portal splash (router origin) to load live plans.
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
}
