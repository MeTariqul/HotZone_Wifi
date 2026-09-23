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

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  if (seconds < 604800) return `${seconds / 86400}d`;
  return `${seconds / 604800}w`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function AdminPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vouchers' | 'generate' | 'router'>('vouchers');
  const [genPlan, setGenPlan] = useState('hourly');
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [routerStatus, setRouterStatus] = useState<RouterStatus | null>(null);
  const [routerClients, setRouterClients] = useState<string>('');
  const [routerActive, setRouterActive] = useState<string>('');
  const [routerLoading, setRouterLoading] = useState(false);

  const fetchData = () => {
    fetch('/api/vouchers')
      .then(r => r.json())
      .then(data => {
        setVouchers(data.vouchers);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(console.error);
  };

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
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'router') fetchRouter();
  }, [activeTab, fetchRouter]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const payRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: genPlan }),
      });
      const payData = await payRes.json();

      const confirmRes = await fetch('/api/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payData.paymentId }),
      });
      const confirmData = await confirmRes.json();

      setNewCode(confirmData.voucher.code);
      fetchData();
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-sky-400">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">Tarif Hotspot Management</p>
          </div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
            Public Site
          </Link>
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
                      Make sure ROUTER_URL and ROUTER_SECRET are set in Vercel environment variables.
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
                              fetchRouter();
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
                              fetchRouter();
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
                            fetchRouter();
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
            <h3 className="text-lg font-semibold mb-4">Generate Voucher</h3>
            <div className="flex gap-4 items-end">
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
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {newCode && (
              <div className="mt-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Generated voucher:</p>
                <p className="text-xl font-mono font-bold text-emerald-400 tracking-wider">{newCode}</p>
              </div>
            )}
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
