import { NextRequest, NextResponse } from 'next/server';
import { getNewVouchers } from '@/lib/db';

const API_KEY = process.env.SYNC_API_KEY;

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('x-api-key');
  const urlKey = request.nextUrl.searchParams.get('key');

  if (!authHeader && !urlKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provided = authHeader || urlKey || '';
  let match = 0;
  for (let i = 0; i < provided.length && i < API_KEY.length; i++) {
    match |= provided.charCodeAt(i) ^ API_KEY.charCodeAt(i);
  }
  if (provided.length !== API_KEY.length || match !== 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get timestamp parameter (default: 0 = all vouchers)
  const sinceParam = request.nextUrl.searchParams.get('since');
  const since = sinceParam ? parseInt(sinceParam, 10) : 0;

  const vouchers = await getNewVouchers(since);

  return NextResponse.json({
    vouchers,
    timestamp: Math.floor(Date.now() / 1000),
    count: vouchers.length,
  });
}
