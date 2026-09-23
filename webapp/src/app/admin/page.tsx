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
  router_id?: string | null;
}

interface RouterRecord {
  id: string;
  label: string;
  location: string | null;
  registered_at: number;
  last_seen_at: number;
  online: boolean;
  age_seconds: number;
}

interface ParsedClient {
  mac: string;
  ip: string;
  hostname: string;
  connectedAt: number | null;
  downloadKbps: number | null;
  uploadKbps: number | null;
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

function formatSince(ts: number): string {
  const delta = Math.floor(Date.now() / 1000) - ts;
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return formatTime(ts);
}

function parseClients(raw: string): ParsedClient[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(entry => {
      const parts = entry.split('|');
      const mac = parts[0] || '';
      const ip = parts[1] || '';
      if (!mac && !ip) return null;
      const connectedRaw = parts[3] || '';
      const dlRaw = parts[4] || '';
      const ulRaw = parts[5] || '';
      return {
        mac,
        ip,
        hostname: parts[2] || '',
        connectedAt: connectedRaw ? Number(connectedRaw) || null : null,
        downloadKbps: dlRaw ? Number(dlRaw) || null : null,
        uploadKbps: ulRaw ? Number(ulRaw) || null : null,
      } satisfies ParsedClient;
    })
    .filter((c): c is ParsedClient => c !== null);
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
  const [activeTab, setActiveTab] = useState<'vouchers' | 'generate' | 'discounts' | 'router' | 'routers'>('vouchers');
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
  const [routers, setRouters] = useState<RouterRecord[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);
  const [routersLoading, setRoutersLoading] = useState(false);
  const [renameDraft, setRenameDraft] = useState<Record<string, { label: string; location: string }>>({});
  const [qosDrafts, setQosDrafts] = useState<Record<string, { download: string; upload: string }>>({});
  const [deviceActionPending, setDeviceActionPending] = useState<string | null>(null);

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

  const routerQuery = useCallback(() => {
    const p = new URLSearchParams({ action: 'status' });
    if (selectedRouterId) p.set('routerId', selectedRouterId);
    const p2 = new URLSearchParams({ action: 'clients' });
    if (selectedRouterId) p2.set('routerId', selectedRouterId);
    const p3 = new URLSearchParams({ action: 'active' });
    if (selectedRouterId) p3.set('routerId', selectedRouterId);
    return Promise.all([
      fetch(`/api/router?${p}`).then(r => r.json()),
      fetch(`/api/router?${p2}`).then(r => r.json()),
      fetch(`/api/router?${p3}`).then(r => r.json()),
    ]);
  }, [selectedRouterId]);

  const loadRouters = useCallback((signal?: { cancelled: boolean }) => {
    return fetch('/api/admin/routers')
      .then(r => (r.ok ? r.json() : { routers: [] }))
      .then(data => {
        if (signal?.cancelled) return;
        setRouters(data.routers || []);
      })
      .catch(() => {
        if (signal?.cancelled) return;
        setRouters([]);
      });
  }, []);

  const fetchRouters = useCallback(() => {
    setRoutersLoading(true);
    loadRouters().finally(() => setRoutersLoading(false));
  }, [loadRouters]);

  const fetchRouter = useCallback(() => {
    setRouterLoading(true);
    routerQuery()
      .then(([status, clients, active]) => {
        setRouterStatus(status);
        setRouterClients(clients.clients || '');
        setRouterActive(active.active || '');
        setRouterLoading(false);
      })
      .catch(() => setRouterLoading(false));
  }, [routerQuery]);

  const queueDeviceAction = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch('/api/router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ...(selectedRouterId ? { routerId: selectedRouterId } : {}),
        }),
      });
      return res.ok ? res.json() : res.json().then(d => Promise.reject(new Error(d.error || 'failed')));
    },
    [selectedRouterId]
  );

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
    if (authState !== 'authed') return;
    if (activeTab !== 'router' && activeTab !== 'routers') return;
    const signal = { cancelled: false };
    loadRouters(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [authState, activeTab, loadRouters]);

  useEffect(() => {
    if (authState !== 'authed' || activeTab !== 'router') return;
    let cancelled = false;
    const run = async () => {
      setRouterLoading(true);
      try {
        const [status, clients, active] = await routerQuery();
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
  }, [authState, activeTab, routerQuery]);

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

  const handleRenameRouter = async (id: string) => {
    const draft = renameDraft[id];
    if (!draft) return;
    await fetch('/api/admin/routers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label: draft.label, location: draft.location }),
    });
    fetchRouters();
  };

  const handleSetSpeed = async (ip: string) => {
    const draft = qosDrafts[ip];
    if (!draft) return;
    const download = Number(draft.download);
    const upload = Number(draft.upload);
    if (!Number.isFinite(download) || !Number.isFinite(upload) || download <= 0 || upload <= 0) {
      return;
    }
    setDeviceActionPending(ip);
    try {
      await queueDeviceAction({ action: 'qos', ip, download, upload });
      setTimeout(fetchRouter, 16000);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    } finally {
      setDeviceActionPending(null);
    }
  };

  const handleBlockDevice = async (ip: string) => {
    setDeviceActionPending(ip);
    try {
      await queueDeviceAction({ action: 'block', ip });
      setTimeout(fetchRouter, 16000);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    } finally {
      setDeviceActionPending(null);
    }
  };

  const handleUnblockDevice = async (ip: string) => {
    setDeviceActionPending(ip);
    try {
      await queueDeviceAction({ action: 'unblock', ip });
      setTimeout(fetchRouter, 16000);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    } finally {
      setDeviceActionPending(null);
    }
  };

  const handleKickSession = async (code: string) => {
    setDeviceActionPending(code);
    try {
      await queueDeviceAction({ action: 'kick', code });
      setTimeout(fetchRouter, 16000);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    } finally {
      setDeviceActionPending(null);
    }
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
            onClick={() => setActiveTab('routers')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'routers' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Routers
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

        {activeTab === 'routers' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Routers</h3>
              <button
                onClick={fetchRouters}
                disabled={routersLoading}
                className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
              >
                {routersLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {routers.length === 0 ? (
              <div className="text-slate-500 text-sm">
                No routers registered yet. The daemon registers itself on first sync with a generated
                <code className="mx-1 text-slate-400">router_id</code>.
              </div>
            ) : (
              <div className="space-y-3">
                {routers.map(r => {
                  const draft = renameDraft[r.id] || { label: r.label, location: r.location || '' };
                  return (
                    <div key={r.id} className="bg-slate-800/50 rounded-lg px-4 py-4 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            r.online ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                          title={r.online ? 'Online' : `Last seen ${formatSince(r.last_seen_at)}`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.label}</p>
                          <p className="text-xs text-slate-500 font-mono truncate">{r.id}</p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-400 md:w-40">
                        {r.location || <span className="text-slate-600">No location</span>}
                      </div>
                      <div className="text-sm text-slate-500 md:w-40">
                        {r.online ? 'Online' : `Seen ${formatSince(r.last_seen_at)}`}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                        <input
                          type="text"
                          value={draft.label}
                          onChange={e =>
                            setRenameDraft(prev => ({
                              ...prev,
                              [r.id]: { ...draft, label: e.target.value },
                            }))
                          }
                          className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-1.5 w-36"
                          placeholder="Label"
                        />
                        <input
                          type="text"
                          value={draft.location}
                          onChange={e =>
                            setRenameDraft(prev => ({
                              ...prev,
                              [r.id]: { ...draft, location: e.target.value },
                            }))
                          }
                          className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-1.5 w-36"
                          placeholder="Location"
                        />
                        <button
                          onClick={() => handleRenameRouter(r.id)}
                          className="bg-sky-700 hover:bg-sky-600 text-white text-xs px-3 py-1.5 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRouterId(r.id);
                            setActiveTab('router');
                          }}
                          className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'router' && (
          <div className="space-y-6">
            {/* Active router selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-400">Active router:</span>
              <select
                value={selectedRouterId ?? ''}
                onChange={e => setSelectedRouterId(e.target.value || null)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
              >
                <option value="">Default (legacy / auto)</option>
                {routers.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {r.online ? ' · online' : ' · offline'}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setActiveTab('routers')}
                className="text-xs text-slate-500 hover:text-slate-300 underline"
              >
                Manage routers
              </button>
            </div>

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
                  {parseClients(routerClients).map(c => {
                    const qos = qosDrafts[c.ip] || {
                      download: c.downloadKbps ? String(c.downloadKbps) : '',
                      upload: c.uploadKbps ? String(c.uploadKbps) : '',
                    };
                    const busy = deviceActionPending === c.ip;
                    return (
                      <div key={c.ip} className="bg-slate-800/50 rounded-lg px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-4 min-w-0">
                            <span className="font-mono text-sm text-sky-400">{c.mac || '—'}</span>
                            <span className="font-mono text-sm text-slate-400">{c.ip || '—'}</span>
                            {c.hostname && <span className="text-sm text-slate-300">{c.hostname}</span>}
                            {c.connectedAt && (
                              <span className="text-xs text-slate-500">
                                since {formatTime(c.connectedAt)}
                              </span>
                            )}
                            {(c.downloadKbps || c.uploadKbps) && (
                              <span className="text-xs text-slate-500">
                                {c.downloadKbps ?? '—'}↓ / {c.uploadKbps ?? '—'}↑ kbps
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUnblockDevice(c.ip)}
                              disabled={busy}
                              className="bg-emerald-900/50 hover:bg-emerald-800 disabled:opacity-50 text-emerald-400 text-xs px-3 py-1 rounded"
                            >
                              Unblock
                            </button>
                            <button
                              onClick={() => handleBlockDevice(c.ip)}
                              disabled={busy}
                              className="bg-red-900/50 hover:bg-red-800 disabled:opacity-50 text-red-400 text-xs px-3 py-1 rounded"
                            >
                              Ban
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="text-xs text-slate-500">Speed limit (kbps)</label>
                          <input
                            type="number"
                            min={64}
                            value={qos.download}
                            onChange={e =>
                              setQosDrafts(prev => ({
                                ...prev,
                                [c.ip]: { ...qos, download: e.target.value },
                              }))
                            }
                            className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 w-24"
                            placeholder="Down"
                          />
                          <input
                            type="number"
                            min={64}
                            value={qos.upload}
                            onChange={e =>
                              setQosDrafts(prev => ({
                                ...prev,
                                [c.ip]: { ...qos, upload: e.target.value },
                              }))
                            }
                            className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 w-24"
                            placeholder="Up"
                          />
                          <button
                            onClick={() => handleSetSpeed(c.ip)}
                            disabled={busy}
                            className="bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs px-3 py-1 rounded"
                          >
                            {busy ? 'Queuing...' : 'Set speed'}
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
                    const busy = deviceActionPending === parts[0];
                    return (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                        <div className="flex gap-4 text-sm">
                          <span className="font-mono text-sky-400">{parts[0] || '—'}</span>
                          <span className="font-mono text-slate-400">{parts[2] || '—'}</span>
                          <span className="text-slate-500">{parts[1] || '—'}</span>
                        </div>
                        <button
                          onClick={() => handleKickSession(parts[0])}
                          disabled={busy}
                          className="bg-red-900/50 hover:bg-red-800 disabled:opacity-50 text-red-400 text-xs px-3 py-1 rounded"
                        >
                          {busy ? 'Queuing...' : 'Kick'}
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
