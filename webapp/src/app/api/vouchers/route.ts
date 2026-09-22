import { NextResponse } from 'next/server';
import { getVouchers, getStats } from '@/lib/db';

export async function GET() {
  const vouchers = getVouchers();
  const stats = getStats();
  return NextResponse.json({ vouchers, stats });
}
