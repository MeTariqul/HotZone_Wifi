import { NextRequest, NextResponse } from 'next/server';
import {
  upsertRouterSnapshot,
  claimRouterCommands,
  completeRouterCommand,
  touchRouter,
  normalizeRouterId,
} from '@/lib/db';
import { verifySyncKey } from '@/lib/auth';

function isAuthorized(request: NextRequest): boolean {
  return verifySyncKey(request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key'));
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const routerId = normalizeRouterId(asString(body.router_id));
  if (routerId) {
    await touchRouter(routerId, {
      label: asString(body.label),
      location: asString(body.location),
    });
  }

  if (body.status && typeof body.status === 'object') {
    await upsertRouterSnapshot('status', JSON.stringify(body.status), routerId);
  }
  const clients = asString(body.clients);
  if (clients !== null) {
    await upsertRouterSnapshot('clients', clients, routerId);
  }
  const active = asString(body.active);
  if (active !== null) {
    await upsertRouterSnapshot('active', active, routerId);
  }

  const acks = Array.isArray(body.acks) ? body.acks : [];
  for (const ack of acks) {
    if (!ack || typeof ack !== 'object') continue;
    const id = asString((ack as Record<string, unknown>).id);
    if (!id) continue;
    const success = (ack as Record<string, unknown>).success === true;
    const error = asString((ack as Record<string, unknown>).error) || undefined;
    await completeRouterCommand(id, success, error);
  }

  const claimed = await claimRouterCommands(routerId);
  const commands = claimed.map((c) => ({
    id: c.id,
    action: c.action,
    code: c.code,
    ip: c.ip,
    payload: c.payload,
  }));

  return NextResponse.json({ ok: true, commands });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const routerId = normalizeRouterId(request.nextUrl.searchParams.get('router_id'));
  const claimed = await claimRouterCommands(routerId);
  return NextResponse.json({
    ok: true,
    commands: claimed.map((c) => ({
      id: c.id,
      action: c.action,
      code: c.code,
      ip: c.ip,
      payload: c.payload,
    })),
  });
}
