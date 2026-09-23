import { NextRequest, NextResponse } from 'next/server';
import {
  listRouters,
  getRouter,
  updateRouterMeta,
  normalizeRouterId,
  writeAudit,
  ROUTER_ONLINE_SECONDS,
} from '@/lib/db';

function decorate(r: {
  id: string;
  label: string;
  location: string | null;
  registered_at: number;
  last_seen_at: number;
}) {
  const age = Math.floor(Date.now() / 1000) - r.last_seen_at;
  return { ...r, online: age <= ROUTER_ONLINE_SECONDS, age_seconds: age };
}

export async function GET() {
  try {
    const routers = await listRouters();
    return NextResponse.json({ routers: routers.map(decorate) });
  } catch {
    return NextResponse.json({ error: 'Failed to list routers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = normalizeRouterId(typeof body.id === 'string' ? body.id : null);
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await getRouter(id);
    if (!existing) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    const meta: { label?: string; location?: string | null } = {};
    if (typeof body.label === 'string') meta.label = body.label;
    if (typeof body.location === 'string' || body.location === null) meta.location = body.location;

    if (meta.label === undefined && meta.location === undefined) {
      return NextResponse.json({ error: 'label or location required' }, { status: 400 });
    }

    const updated = await updateRouterMeta(id, meta);
    if (!updated) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }
    await writeAudit('router.update', `id=${id}`);
    return NextResponse.json({ router: decorate(updated) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update router';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
