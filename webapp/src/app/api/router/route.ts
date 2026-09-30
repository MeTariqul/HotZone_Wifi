import { NextRequest, NextResponse } from 'next/server';
import {
  getRouterSnapshot,
  enqueueRouterCommand,
  resolveRouterId,
  writeAudit,
} from '@/lib/db';

const STALE_SECONDS = 10;

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

async function snapshotResult(kind: 'status' | 'clients' | 'active', routerId: string) {
  const snap = await getRouterSnapshot(kind, routerId);
  if (!snap) {
    return {
      success: false,
      error: 'No router snapshot yet — waiting for router to push status',
      stale: true,
      updated_at: null,
      router_id: routerId || null,
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
      router_id: snap.router_id || routerId || null,
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
      router_id: snap.router_id || routerId || null,
    };
  }

  return {
    success: true,
    active: typeof payload === 'string' ? payload : '',
    stale,
    age_seconds: age,
    updated_at: snap.updated_at,
    router_id: snap.router_id || routerId || null,
  };
}

export async function GET(request: NextRequest) {
  const rawAction = request.nextUrl.searchParams.get('action') || 'status';
  const actions = rawAction
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  const valid = new Set(['status', 'clients', 'active']);
  if (actions.length === 0 || actions.some(a => !valid.has(a))) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const routerId = await resolveRouterId(request.nextUrl.searchParams.get('routerId'));

  if (actions.length === 1) {
    const result = await snapshotResult(actions[0] as 'status' | 'clients' | 'active', routerId);
    return NextResponse.json(result);
  }

  // Multi-snapshot: one round-trip for live admin refresh
  const results = await Promise.all(
    actions.map(async a => [a, await snapshotResult(a as 'status' | 'clients' | 'active', routerId)] as const)
  );
  return NextResponse.json(Object.fromEntries(results));
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

  const download = typeof body.download === 'number' ? body.download : undefined;
  const upload = typeof body.upload === 'number' ? body.upload : undefined;
  if (action === 'qos' && (download === undefined || upload === undefined)) {
    return NextResponse.json({ error: 'download and upload (kbps) required' }, { status: 400 });
  }

  const payload =
    action === 'authorize' || action === 'qos'
      ? JSON.stringify({
          code,
          ip,
          mac: typeof body.mac === 'string' ? body.mac : '',
          duration: typeof body.duration === 'number' ? body.duration : undefined,
          download,
          upload,
        })
      : null;

  const routerId = await resolveRouterId(
    typeof body.routerId === 'string' ? body.routerId : null
  );
  const cmd = await enqueueRouterCommand(action, { code, ip, payload, routerId });

  if (action !== 'authorize') {
    await writeAudit(
      `router.${action}`,
      [ip && `ip=${ip}`, code && `code=${code}`, download !== undefined && `dl=${download}`, upload !== undefined && `ul=${upload}`]
        .filter(Boolean)
        .join(' ') || undefined
    );
  }

  return NextResponse.json({
    success: true,
    queued: true,
    id: cmd.id,
    router_id: routerId || null,
    note: 'Command queued — router will run it on next poll (~2s)',
  });
}
