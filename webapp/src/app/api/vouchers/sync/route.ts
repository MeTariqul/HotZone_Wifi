import { NextRequest, NextResponse } from 'next/server';
import { getNewVouchers } from '@/lib/db';
import { verifySyncKey } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-api-key');
  const urlKey = request.nextUrl.searchParams.get('key');

  if (!verifySyncKey(authHeader || urlKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sinceParam = request.nextUrl.searchParams.get('since');
  const since = sinceParam ? parseInt(sinceParam, 10) : 0;

  const vouchers = await getNewVouchers(since);

  return NextResponse.json({
    vouchers,
    timestamp: Math.floor(Date.now() / 1000),
    count: vouchers.length,
  });
}
