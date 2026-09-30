import { NextRequest, NextResponse } from 'next/server';
import { authorizeClient } from '@/lib/router';
import { enqueueRouterCommand, redeemVoucher, upsertDevice } from '@/lib/db';
import { DEVICE_COOKIE, deviceCookieOptions, issueDeviceId, isValidDeviceId } from '@/lib/device';
import { normalizeCode } from '@/lib/voucher-code';

export async function POST(request: NextRequest) {
  try {
    const { code, ip, mac, duration, download, upload } = await request.json();

    const normalized = normalizeCode(String(code || ''));
    if (!normalized || !ip) {
      return NextResponse.json({ error: 'code and ip are required' }, { status: 400 });
    }

    const cookieId = request.cookies.get(DEVICE_COOKIE)?.value;
    const deviceId = isValidDeviceId(cookieId) ? cookieId : issueDeviceId();

    await upsertDevice(deviceId, { mac: mac || null, ip: String(ip) });
    await redeemVoucher(normalized, { mac: mac || null, deviceId });

    // Prefer direct call when ROUTER_URL is configured (LAN deployments).
    // Otherwise queue for the router daemon to execute on next poll.
    if (process.env.ROUTER_URL) {
      const result = await authorizeClient({
        code: normalized,
        ip,
        mac: mac || '',
        duration: duration || 3600,
        download: download || 10240,
        upload: upload || 2048,
      });
      const response = NextResponse.json(result);
      response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
      return response;
    }

    const payload = JSON.stringify({
      code: normalized,
      ip,
      mac: mac || '',
      duration: duration || 3600,
      download: download || 10240,
      upload: upload || 2048,
    });
    const cmd = await enqueueRouterCommand('authorize', { code: normalized, ip, payload });
    const response = NextResponse.json({
      success: true,
      queued: true,
      id: cmd.id,
      message: 'Authorization queued for router',
    });
    response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Authorization failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
