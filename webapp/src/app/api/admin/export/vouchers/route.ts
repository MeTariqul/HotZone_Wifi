import { NextRequest, NextResponse } from 'next/server';
import { getVouchers, getPlans } from '@/lib/db';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const usedParam = request.nextUrl.searchParams.get('used');
    const planParam = request.nextUrl.searchParams.get('plan');
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();

    const [vouchers, plans] = await Promise.all([getVouchers(), getPlans()]);
    const planName = new Map(plans.map(p => [p.id, p.name]));

    let rows = vouchers;
    if (usedParam === '1') rows = rows.filter(v => v.used === 1);
    if (usedParam === '0') rows = rows.filter(v => v.used === 0);
    if (planParam) rows = rows.filter(v => v.plan_id === planParam);
    if (q) {
      rows = rows.filter(
        v =>
          v.code.toLowerCase().includes(q) ||
          (v.note || '').toLowerCase().includes(q) ||
          (v.used_by_mac || '').toLowerCase().includes(q)
      );
    }

    const header = [
      'code',
      'plan_id',
      'plan',
      'duration_seconds',
      'download_kbps',
      'upload_kbps',
      'used',
      'used_by_mac',
      'used_at',
      'created_at',
      'source',
      'note',
    ];
    const lines = [header.join(',')];
    for (const v of rows) {
      lines.push(
        [
          v.code,
          v.plan_id,
          planName.get(v.plan_id) || v.plan_id,
          v.duration_seconds,
          v.download_kbps,
          v.upload_kbps,
          v.used,
          v.used_by_mac || '',
          v.used_at || '',
          v.created_at,
          v.source,
          v.note || '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    const body = lines.join('\n') + '\n';
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hotspot-vouchers-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
