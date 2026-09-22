import { NextRequest, NextResponse } from 'next/server';
import { getNewVouchers } from '@/lib/db';

// Shared secret for router authentication
const API_KEY = 'tarif-hotspot-2024';

export async function GET(request: NextRequest) {
  // Verify API key from header or query
  const authHeader = request.headers.get('x-api-key');
  const urlKey = request.nextUrl.searchParams.get('key');

  if (authHeader !== API_KEY && urlKey !== API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get timestamp parameter (default: 0 = all vouchers)
  const sinceParam = request.nextUrl.searchParams.get('since');
  const since = sinceParam ? parseInt(sinceParam, 10) : 0;

  const vouchers = getNewVouchers(since);

  return NextResponse.json({
    vouchers,
    timestamp: Math.floor(Date.now() / 1000),
    count: vouchers.length,
  });
}
