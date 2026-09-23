import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Hotspot performance, redemptions, and revenue',
};

async function getOverview() {
  const { getStats, getVouchers, getPlans } = await import('@/lib/db');
  const [stats, vouchers, plans] = await Promise.all([getStats(), getVouchers(), getPlans()]);
  const planMap = new Map(plans.map(p => [p.id, p.name]));
  const byPlan = new Map<string, { total: number; used: number }>();
  for (const v of vouchers) {
    const key = v.plan_id;
    const row = byPlan.get(key) || { total: 0, used: 0 };
    row.total += 1;
    if (v.used) row.used += 1;
    byPlan.set(key, row);
  }
  const planRows = plans.map(p => {
    const r = byPlan.get(p.id) || { total: 0, used: 0 };
    return {
      id: p.id,
      name: p.name,
      price: p.price_bdt,
      total: r.total,
      used: r.used,
      unused: r.total - r.used,
      redeemRate: r.total ? Math.round((r.used / r.total) * 100) : 0,
    };
  });
  const unused = stats.unusedVouchers;
  const used = stats.usedVouchers;
  const overall = used + unused ? Math.round((used / (used + unused)) * 100) : 0;
  return { stats, planRows, overall, planName: planMap };
}

export default async function AnalyticsPage() {
  const { stats, planRows, overall } = await getOverview();
  const avgTicket =
    stats.totalPayments > 0
      ? Math.round((stats.totalRevenue / stats.totalPayments) * 100) / 100
      : 0;

  return (
    <PageShell
      title="Analytics"
      subtitle="Voucher performance and revenue snapshot"
      actions={
        <Link
          href="/admin"
          className="text-sm text-slate-400 hover:text-cyan-300 transition-colors"
        >
          ← Back to dashboard
        </Link>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Redemption</p>
          <p className="text-2xl font-bold tabular text-cyan-400 mt-1">{overall}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.usedVouchers} of {stats.usedVouchers + stats.unusedVouchers} issued
          </p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Revenue</p>
          <p className="text-2xl font-bold tabular text-amber-400 mt-1">
            ৳{stats.totalRevenue}
          </p>
          <p className="text-xs text-slate-500 mt-1">{stats.totalPayments} payments</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Avg ticket</p>
          <p className="text-2xl font-bold tabular mt-1">৳{avgTicket}</p>
          <p className="text-xs text-slate-500 mt-1">per completed payment</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Inventory</p>
          <p className="text-2xl font-bold tabular text-emerald-400 mt-1">
            {stats.unusedVouchers}
          </p>
          <p className="text-xs text-slate-500 mt-1">unused vouchers ready</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-slate-100">By plan</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Issued vs redeemed for each plan
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Issued</th>
                <th className="px-5 py-3 font-medium">Redeemed</th>
                <th className="px-5 py-3 font-medium">Unused</th>
                <th className="px-5 py-3 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {planRows.map(row => (
                <tr key={row.id} className="border-b border-[var(--border)]/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-200">{row.name}</td>
                  <td className="px-5 py-3 tabular text-amber-300">
                    {row.price === 0 ? 'Free' : `৳${row.price}`}
                  </td>
                  <td className="px-5 py-3 tabular">{row.total}</td>
                  <td className="px-5 py-3 tabular text-emerald-300">{row.used}</td>
                  <td className="px-5 py-3 tabular text-slate-400">{row.unused}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${row.redeemRate}%` }}
                        />
                      </div>
                      <span className="tabular text-xs text-slate-400">{row.redeemRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600 mt-4">
        Data refreshes when you open this page. Live router metrics remain under Router → Live.
      </p>
    </PageShell>
  );
}
