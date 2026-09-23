'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Voucher {
  code: string;
  plan_id: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  used: number;
  used_by_mac: string | null;
  used_at: number | null;
  created_at: number;
}

interface Stats {
  totalVouchers: number;
  usedVouchers: number;
  unusedVouchers: number;
  totalPayments: number;
  totalRevenue: number;
}

interface RouterStatus {
  success: boolean;
  active_vouchers?: number;
  connected_clients?: number;
  uptime?: number;
  error?: string;
}

interface DiscountCode {
  code: string;
  type: 'percent' | 'fixed' | 'free';
  value: number;
  plan_id: string | null;
  max_uses: number;
  used_count: number;
  active: number;
  expires_at: number | null;
  created_at: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  if (seconds < 604800) return `${seconds / 86400}d`;
  return `${seconds / 604800}w`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-sm w-full">
        <h1 className="text-xl font-bold text-sky-400 mb-1">Admin Login</h1>
        <p className="text-sm text-slate-500 mb-6">Enter password to continue</p>
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 mb-4 focus:border-sky-500 focus:outline-none"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <Link href="/" className="block text-center text-sm text-slate-500 hover:text-slate-300 mt-4">
          Back to site
        </Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'authed'>('loading');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'vouchers' | 'generate' | 'discounts' | 'router'>('vouchers');
  const [genPlan, setGenPlan] = useState('hourly');
  const [genCount, setGenCount] = useState(1);
  const [genNote, setGenNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [dcType, setDcType] = useState<'percent' | 'fixed' | 'free'>('percent');
  const [dcValue, setDcValue] = useState(10);
  const [dcPlan, setDcPlan] = useState('');
  const [dcMaxUses, setDcMaxUses] = useState(1);
  const [dcCreating, setDcCreating] = useState(false);
  const [dcError, setDcError] = useState('');
  const [routerStatus, setRouterStatus] = useState<RouterStatus | null>(null);
  const [routerClients, setRouterClients] = useState<string>('');
  const [routerActive, setRouterActive] = useState<string>('');
  const [routerLoading, setRouterLoading] = useState(false);

  const fetchData = useCallback(() => {
    fetch('/api/vouchers')
      .then(r => {
        if (r.status === 401) {
          setAuthState('login');
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data) {
          setVouchers(data.vouchers);
          setStats(data.stats);
          setAuthState('authed');
        }
      })
      .catch(() => setAuthState('login'));
  }, []);

  const fetchDiscounts = useCallback(() => {
    fetch('/api/admin/discount-codes')
      .then(r => (r.ok ? r.json() : { codes: [] }))
      .then(data => setDiscountCodes(data.codes || []))
      .catch(() => setDiscountCodes([]));
  }, []);

  const fetchRouter = useCallback(() => {
    setRouterLoading(true);
    Promise.all([
      fetch('/api/router?action=status').then(r => r.json()),
      fetch('/api/router?action=clients').then(r => r.json()),
      fetch('/api/router?action=active').then(r => r.json()),
    ])
      .then(([status, clients, active]) => {
        setRouterStatus(status);
        setRouterClients(clients.clients || '');
        setRouterActive(active.active || '');
        setRouterLoading(false);
      })
      .catch(() => setRouterLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/auth/check')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          setAuthState('authed');
          fetchData();
        } else {
          setAuthState('login');
        }
      })
      .catch(() => setAuthState('login'));
  }, [fetchData]);

  useEffect(() => {
    if (authState !== 'authed' || activeTab !== 'router') return;
    let cancelled = false;
    const run = async () => {
      setRouterLoading(true);
      try {
        const [status, clients, active] = await Promise.all([
          fetch('/api/router?action=status').then(r => r.json()),
          fetch('/api/router?action=clients').then(r => r.json()),
          fetch('/api/router?action=active').then(r => r.json()),
        ]);
        if (!cancelled) {
          setRouterStatus(status);
          setRouterClients(clients.clients || '');
          setRouterActive(active.active || '');
        }
      } catch {
        // ignore — panel shows unreachable state
      } finally {
        if (!cancelled) setRouterLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [authState, activeTab]);

  useEffect(() => {
    if (authState === 'authed' && activeTab === 'discounts') fetchDiscounts();
  }, [authState, activeTab, fetchDiscounts]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthState('login');
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setNewCodes([]);
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: genPlan,
          count: genCount,
          note: genNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setNewCodes(data.vouchers.map((v: Voucher) => v.code));
      fetchData();
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : err);
    }
    setGenerating(false);
  };

  const handleCreateDiscount = async () => {
    setDcCreating(true);
    setDcError('');
    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: dcType,
          value: dcValue,
          plan_id: dcPlan || null,
          max_uses: dcMaxUses,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Creation failed');
      fetchDiscounts();
      setDcValue(dcType === 'percent' ? 10 : 10);
      setDcMaxUses(1);
    } catch (err: unknown) {
      setDcError(err instanceof Error ? err.message : 'Creation failed');
    }
    setDcCreating(false);
  };

  const handleDeactivateDiscount = async (code: string) => {
    await fetch('/api/admin/discount-codes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    fetchDiscounts();
  };

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (authState === 'login') {
    return <LoginForm onSuccess={() => { setAuthState('authed'); fetchData(); }} />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-sky-400">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">Tarif Hotspot Management</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
              Public Site
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Vouchers</p>
            <p className="text-2xl font-bold mt-1">{stats?.totalVouchers || 0}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Used</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">{stats?.usedVouchers || 0}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Payments</p>
            <p className="text-2xl font-bold mt-1">{stats?.totalPayments || 0}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Revenue</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">৳{stats?.totalRevenue || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'vouchers' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vouchers
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'generate' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Generate
          </button>
          <button
            onClick={() => setActiveTab('discounts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'discounts' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Discounts
          </button>
          <button
            onClick={() => setActiveTab('router')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'router' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Router
          </button>
        </div>

        {activeTab === 'router' && (
          <div className="space-y-6">
            {/* Router Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Router Status</h3>
                <button
                  onClick={fetchRouter}
                  disabled={routerLoading}
                  className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                >
                  {routerLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              {routerStatus ? (
                routerStatus.success ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Connected Clients</p>
                      <p className="text-3xl font-bold text-emerald-400 mt-1">{routerStatus.connected_clients || 0}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Active Vouchers</p>
                      <p className="text-3xl font-bold text-sky-400 mt-1">{routerStatus.active_vouchers || 0}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Uptime</p>
                      <p className="text-3xl font-bold text-amber-400 mt-1">
                        {routerStatus.uptime ? Math.floor(routerStatus.uptime / 3600) + 'h' : '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-red-400">
                    Router unreachable: {routerStatus.error || 'Unknown error'}
                    <p className="text-sm text-red-500/70 mt-2">
                      Waiting for the router to push a status snapshot to /api/router/sync.
                      Ensure hotspot-sync-daemon is running and SYNC_API_KEY matches.
                    </p>
                  </div>
                )
              ) : (
                <div className="text-slate-500">Click Refresh to check router status</div>
              )}
            </div>

            {/* Connected Clients */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Connected Clients</h3>
              {routerClients ? (
                <div className="space-y-2">
                  {routerClients.split(',').map((c, i) => {
                    const parts = c.split('|');
                    return (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm text-sky-400">{parts[0] || '—'}</span>
                          <span className="font-mono text-sm text-slate-400">{parts[1] || '—'}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await fetch('/api/router', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'block', ip: parts[1] }),
                              });
                              setTimeout(fetchRouter, 16000);
                            }}
                            className="bg-red-900/50 hover:bg-red-800 text-red-400 text-xs px-3 py-1 rounded"
                          >
                            Block
                          </button>
                          <button
                            onClick={async () => {
                              await fetch('/api/router', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'unblock', ip: parts[1] }),
                              });
                              setTimeout(fetchRouter, 16000);
                            }}
                            className="bg-emerald-900/50 hover:bg-emerald-800 text-emerald-400 text-xs px-3 py-1 rounded"
                          >
                            Unblock
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-500">No clients connected or router unreachable</div>
              )}
            </div>

            {/* Active Vouchers on Router */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Active Sessions on Router</h3>
              {routerActive ? (
                <div className="space-y-2">
                  {routerActive.split('\n').filter(Boolean).map((line, i) => {
                    const parts = line.split(' ');
                    return (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-mono text-sky-400">{parts[0] || '—'}</span>
                          <span className="font-mono text-slate-400">{parts[2] || '—'}</span>
                          <span className="text-slate-500">{parts[1] || '—'}</span>
                        </div>
                        <button
onClick={async () => {
                              await fetch('/api/router', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'kick', code: parts[0] }),
                              });
                              setTimeout(fetchRouter, 16000);
                            }}
                          className="bg-red-900/50 hover:bg-red-800 text-red-400 text-xs px-3 py-1 rounded"
                        >
                          Kick
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-500">No active sessions</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Generate Free Vouchers</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Plan</label>
                <select
                  value={genPlan}
                  onChange={e => setGenPlan(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2"
                >
                  <option value="trial">Trial (Free)</option>
                  <option value="hourly">Hourly (৳20)</option>
                  <option value="daily">Daily (৳50)</option>
                  <option value="weekly">Weekly (৳200)</option>
                  <option value="monthly">Monthly (৳500)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Count</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={e => setGenCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 w-24"
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-sm text-slate-400 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={genNote}
                  onChange={e => setGenNote(e.target.value)}
                  placeholder="e.g. promo, staff, giveaway"
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 w-full"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {newCodes.length > 0 && (
              <div className="mt-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-2">Generated {newCodes.length} voucher(s):</p>
                <div className="space-y-1">
                  {newCodes.map(code => (
                    <p key={code} className="font-mono font-bold text-emerald-400 tracking-wider select-all">
                      {code}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'discounts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Create Discount Code</h3>
              {dcError && (
                <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-3 mb-4 text-sm">
                  {dcError}
                </div>
              )}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Type</label>
                  <select
                    value={dcType}
                    onChange={e => setDcType(e.target.value as 'percent' | 'fixed' | 'free')}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2"
                  >
                    <option value="percent">Percent off</option>
                    <option value="fixed">Fixed BDT off</option>
                    <option value="free">Free (100% off)</option>
                  </select>
                </div>
                {dcType !== 'free' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {dcType === 'percent' ? 'Percent' : 'Amount (৳)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={dcType === 'percent' ? 100 : undefined}
                      value={dcValue}
                      onChange={e => setDcValue(Number(e.target.value) || 0)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 w-28"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Plan (optional)</label>
                  <select
                    value={dcPlan}
                    onChange={e => setDcPlan(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2"
                  >
                    <option value="">Any plan</option>
                    <option value="trial">Trial</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max uses</label>
                  <input
                    type="number"
                    min={1}
                    value={dcMaxUses}
                    onChange={e => setDcMaxUses(Math.max(1, Number(e.target.value) || 1))}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 w-24"
                  />
                </div>
                <button
                  onClick={handleCreateDiscount}
                  disabled={dcCreating}
                  className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  {dcCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-500">
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Value</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Uses</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountCodes.map(dc => (
                      <tr key={dc.code} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-sky-400 select-all">{dc.code}</td>
                        <td className="px-4 py-3 capitalize">{dc.type}</td>
                        <td className="px-4 py-3">
                          {dc.type === 'percent' ? `${dc.value}%` : dc.type === 'free' ? 'Free' : `৳${dc.value}`}
                        </td>
                        <td className="px-4 py-3 capitalize">{dc.plan_id || 'Any'}</td>
                        <td className="px-4 py-3">{dc.used_count}/{dc.max_uses}</td>
                        <td className="px-4 py-3">
                          {dc.active ? (
                            <span className="text-emerald-400">Active</span>
                          ) : (
                            <span className="text-slate-500">Disabled</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {dc.active ? (
                            <button
                              onClick={() => handleDeactivateDiscount(dc.code)}
                              className="bg-red-900/50 hover:bg-red-800 text-red-400 text-xs px-3 py-1 rounded"
                            >
                              Disable
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {discountCodes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No discount codes yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vouchers' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Speed</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map(v => (
                    <tr key={v.code} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-sky-400">{v.code}</td>
                      <td className="px-4 py-3 capitalize">{v.plan_id}</td>
                      <td className="px-4 py-3">{formatDuration(v.duration_seconds)}</td>
                      <td className="px-4 py-3">{v.download_kbps / 1024} Mbps</td>
                      <td className="px-4 py-3">
                        {v.used ? (
                          <span className="text-amber-400">Used</span>
                        ) : (
                          <span className="text-emerald-400">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatTime(v.created_at)}</td>
                    </tr>
                  ))}
                  {vouchers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No vouchers yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
