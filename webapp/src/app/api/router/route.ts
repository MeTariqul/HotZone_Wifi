import { NextRequest, NextResponse } from 'next/server';
import { getRouterSnapshot, enqueueRouterCommand } from '@/lib/db';

const STALE_SECONDS = 90;

function parseSnapshot(payload: string | undefined): unknown {
  if (payload === undefined) return null;
  if (payload.startsWith('{') || payload.startsWith('[')) {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  return payload;
}

async function snapshotResult(kind: 'status' | 'clients' | 'active') {
  const snap = await getRouterSnapshot(kind);
  if (!snap) {
    return {
      success: false,
      error: 'No router snapshot yet — waiting for router to push status',
      stale: true,
      updated_at: null,
    };
  }

  const age = Math.floor(Date.now() / 1000) - snap.updated_at;
  const stale = age > STALE_SECONDS;
  const payload = parseSnapshot(snap.payload);

  if (kind === 'status') {
    const status = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    return {
      success: true,
      active_vouchers: status.active_vouchers ?? 0,
      connected_clients: status.connected_clients ?? 0,
      uptime: status.uptime ?? 0,
      stale,
      age_seconds: age,
      updated_at: snap.updated_at,
      ...(stale ? { warning: `Snapshot is ${age}s old` } : {}),
    };
  }

  if (kind === 'clients') {
    return {
      success: true,
      clients: typeof payload === 'string' ? payload : '',
      stale,
      age_seconds: age,
      updated_at: snap.updated_at,
    };
  }

  return {
    success: true,
    active: typeof payload === 'string' ? payload : '',
    stale,
    age_seconds: age,
    updated_at: snap.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'status';

  if (action !== 'status' && action !== 'clients' && action !== 'active') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const result = await snapshotResult(action);
  return NextResponse.json(result);
}

const QUEUEABLE = new Set(['kick', 'block', 'unblock', 'authorize', 'qos']);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = typeof body.action === 'string' ? body.action : '';
  const code = typeof body.code === 'string' ? body.code : undefined;
  const ip = typeof body.ip === 'string' ? body.ip : undefined;

  if (!action || !QUEUEABLE.has(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if ((action === 'kick' || action === 'authorize') && !code) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }
  if (
    (action === 'block' || action === 'unblock' || action === 'authorize' || action === 'qos') &&
    !ip
  ) {
    return NextResponse.json({ error: 'ip required' }, { status: 400 });
  }

  const payload =
    action === 'authorize' || action === 'qos'
      ? JSON.stringify({
          code,
          ip,
          mac: typeof body.mac === 'string' ? body.mac : '',
          duration: typeof body.duration === 'number' ? body.duration : undefined,
          download: typeof body.download === 'number' ? body.download : undefined,
          upload: typeof body.upload === 'number' ? body.upload : undefined,
        })
      : null;

  const cmd = await enqueueRouterCommand(action, { code, ip, payload });

  return NextResponse.json({
    success: true,
    queued: true,
    id: cmd.id,
    note: 'Command queued — router will run it on next poll (~15s)',
  });
}
