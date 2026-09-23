import { NextRequest, NextResponse } from 'next/server';
import { authorizeClient } from '@/lib/router';

export async function POST(request: NextRequest) {
  try {
    const { code, ip, mac, duration, download, upload } = await request.json();

    if (!code || !ip) {
      return NextResponse.json({ error: 'code and ip are required' }, { status: 400 });
    }

    const result = await authorizeClient({
      code,
      ip,
      mac: mac || '',
      duration: duration || 3600,
      download: download || 10240,
      upload: upload || 2048,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Authorization failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
