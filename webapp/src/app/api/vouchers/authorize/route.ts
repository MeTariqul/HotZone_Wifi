import { NextRequest, NextResponse } from 'next/server';
import { authorizeClient } from '@/lib/router';
import { enqueueRouterCommand } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { code, ip, mac, duration, download, upload } = await request.json();

    if (!code || !ip) {
      return NextResponse.json({ error: 'code and ip are required' }, { status: 400 });
    }

    // Prefer direct call when ROUTER_URL is configured (LAN deployments).
    // Otherwise queue for the router daemon to execute on next poll.
    if (process.env.ROUTER_URL) {
      const result = await authorizeClient({
        code,
        ip,
        mac: mac || '',
        duration: duration || 3600,
        download: download || 10240,
        upload: upload || 2048,
      });
      return NextResponse.json(result);
    }

    const payload = JSON.stringify({
      code,
      ip,
      mac: mac || '',
      duration: duration || 3600,
      download: download || 10240,
      upload: upload || 2048,
    });
    const cmd = await enqueueRouterCommand('authorize', { code, ip, payload });
    return NextResponse.json({
      success: true,
      queued: true,
      id: cmd.id,
      message: 'Authorization queued for router',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Authorization failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
