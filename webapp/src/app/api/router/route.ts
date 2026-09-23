import { NextRequest, NextResponse } from 'next/server';
import {
  getRouterStatus,
  getRouterClients,
  getActiveVouchers,
  kickVoucher,
  blockClient,
  unblockClient,
} from '@/lib/router';

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'status';

  let result;
  switch (action) {
    case 'status':
      result = await getRouterStatus();
      break;
    case 'clients':
      result = await getRouterClients();
      break;
    case 'active':
      result = await getActiveVouchers();
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { action, code, ip } = await request.json();

  let result;
  switch (action) {
    case 'kick':
      if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
      result = await kickVoucher(code);
      break;
    case 'block':
      if (!ip) return NextResponse.json({ error: 'ip required' }, { status: 400 });
      result = await blockClient(ip);
      break;
    case 'unblock':
      if (!ip) return NextResponse.json({ error: 'ip required' }, { status: 400 });
      result = await unblockClient(ip);
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  return NextResponse.json(result);
}
