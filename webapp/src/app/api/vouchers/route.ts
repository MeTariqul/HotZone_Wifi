import { NextResponse } from 'next/server';
import { getVouchers, getStats } from '@/lib/db';

export async function GET() {
  const vouchers = await getVouchers();
  const stats = await getStats();
  return NextResponse.json({ vouchers, stats });
}
