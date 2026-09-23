'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Stat,
  Input,
  Select,
  Field,
  Alert,
  EmptyState,
  Spinner,
  cn,
} from '@/components/ui';

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

interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  detail: string | null;
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
      <div className="w-full max-w-sm">
        <div className="signal-rule mb-6" />
        <Card className="p-8">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-400 mb-1">
            Tarif
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-50">Admin login</h1>
          <p className="text-sm text-[var(--muted)] mt-1 mb-6">Enter password to continue</p>
          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                required
              />
            </Field>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || !password}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <Link
            href="/"
            className="block text-center text-sm text-slate-500 hover:text-cyan-300 mt-5 transition-colors"
          >
            Back to site
          </Link>
        </Card>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'authed'>('loading');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<
    'vouchers' | 'generate' | 'discounts' | 'router' | 'routers' | 'audit'
  >('vouchers');
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
  const [voucherQuery, setVoucherQuery] = useState('');
  const [voucherStatus, setVoucherStatus] = useState<'all' | 'unused' | 'used'>('all');
  const [exporting, setExporting] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

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

  useEffect(() => {
    if (authState !== 'authed' || activeTab !== 'audit') return;
    let cancelled = false;
    fetch('/api/admin/audit')
      .then(r => (r.ok ? r.json() : { logs: [] }))
      .then(data => {
        if (!cancelled) setAuditLogs(data.logs || []);
      })
      .catch(() => {
        if (!cancelled) setAuditLogs([]);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authState, activeTab]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthState('login');
  };

  const filteredVouchers = useMemo(() => {
    const q = voucherQuery.trim().toLowerCase();
    return vouchers.filter(v => {
      if (voucherStatus === 'unused' && v.used) return false;
      if (voucherStatus === 'used' && !v.used) return false;
      if (!q) return true;
      return (
        v.code.toLowerCase().includes(q) ||
        v.plan_id.toLowerCase().includes(q)
      );
    });
  }, [vouchers, voucherQuery, voucherStatus]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (voucherStatus !== 'all') params.set('used', voucherStatus === 'used' ? '1' : '0');
      if (voucherQuery.trim()) params.set('q', voucherQuery.trim());
      const res = await fetch(`/api/admin/export/vouchers?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vouchers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    } finally {
      setExporting(false);
    }
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
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Spinner className="text-cyan-400" />
          Loading…
        </div>
      </div>
    );
  }

  if (authState === 'login') {
    return <LoginForm onSuccess={() => { setAuthState('authed'); fetchData(); }} />;
  }

  const tabs = [
    { id: 'vouchers', label: 'Vouchers' },
    { id: 'generate', label: 'Generate' },
    { id: 'discounts', label: 'Discounts' },
    { id: 'routers', label: 'Routers' },
    { id: 'router', label: 'Live' },
    { id: 'audit', label: 'Audit' },
  ] as const;

  return (
    <div className="min-h-screen">
      <div className="signal-rule" />
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-400">
              Tarif
            </p>
            <h1 className="text-lg font-bold tracking-tight text-slate-50">Admin</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/analytics"
              className="text-slate-400 hover:text-cyan-300 transition-colors"
            >
              Analytics
            </Link>
            <Link
              href="/"
              className="text-slate-400 hover:text-cyan-300 transition-colors"
            >
              Public site
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Total vouchers" value={stats?.totalVouchers || 0} />
          <Stat
            label="Used"
            value={stats?.usedVouchers || 0}
            tone="money"
            hint={`${stats?.unusedVouchers || 0} unused`}
          />
          <Stat label="Payments" value={stats?.totalPayments || 0} tone="info" />
          <Stat
            label="Revenue"
            value={`৳${stats?.totalRevenue || 0}`}
            tone="success"
          />
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1 mb-6 w-fit max-w-full overflow-x-auto"
          role="tablist"
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'routers' && (
          <Card>
            <CardHeader
              title="Routers"
              description="Registered hotspot gateways"
              actions={
                <Button variant="secondary" size="sm" onClick={fetchRouters} disabled={routersLoading}>
                  {routersLoading ? 'Refreshing…' : 'Refresh'}
                </Button>
              }
            />
            <CardBody>
            {routers.length === 0 ? (
              <EmptyState
                title="No routers registered yet"
                description="The daemon registers itself on first sync with a generated router_id."
              />
            ) : (
              <div className="space-y-3">
                {routers.map(r => {
                  const draft = renameDraft[r.id] || { label: r.label, location: r.location || '' };
                  return (
                    <div key={r.id} className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-4 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            'inline-block w-2.5 h-2.5 rounded-full',
                            r.online ? 'bg-emerald-400' : 'bg-slate-600'
                          )}
                          title={r.online ? 'Online' : `Last seen ${formatSince(r.last_seen_at)}`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate text-slate-100">{r.label}</p>
                          <p className="text-xs text-slate-500 font-mono truncate">{r.id}</p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-400 md:w-40">
                        {r.location || <span className="text-slate-600">No location</span>}
                      </div>
                      <div className="text-sm text-slate-500 md:w-40">
                        {r.online ? (
                          <Badge tone="success">Online</Badge>
                        ) : (
                          `Seen ${formatSince(r.last_seen_at)}`
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                        <Input
                          type="text"
                          value={draft.label}
                          onChange={e =>
                            setRenameDraft(prev => ({
                              ...prev,
                              [r.id]: { ...draft, label: e.target.value },
                            }))
                          }
                          className="w-36 py-1.5 text-sm"
                          placeholder="Label"
                        />
                        <Input
                          type="text"
                          value={draft.location}
                          onChange={e =>
                            setRenameDraft(prev => ({
                              ...prev,
                              [r.id]: { ...draft, location: e.target.value },
                            }))
                          }
                          className="w-36 py-1.5 text-sm"
                          placeholder="Location"
                        />
                        <Button size="sm" onClick={() => handleRenameRouter(r.id)}>
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedRouterId(r.id);
                            setActiveTab('router');
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </CardBody>
          </Card>
        )}

        {activeTab === 'router' && (
          <div className="space-y-6">
            {/* Active router selection */}
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-[var(--muted)]">Active router</span>
                <Select
                  className="w-auto min-w-56"
                  value={selectedRouterId ?? ''}
                  onChange={e => setSelectedRouterId(e.target.value || null)}
                >
                  <option value="">Default (legacy / auto)</option>
                  {routers.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                      {r.online ? ' · online' : ' · offline'}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('routers')}
                >
                  Manage routers
                </Button>
              </div>
            </Card>

            {/* Router Status */}
            <Card>
              <CardHeader
                title="Router status"
                description="Snapshot from the last sync push"
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fetchRouter}
                    disabled={routerLoading}
                  >
                    {routerLoading ? 'Refreshing…' : 'Refresh'}
                  </Button>
                }
              />
              <CardBody>
              {routerStatus ? (
                routerStatus.success ? (
                  <div className="grid grid-cols-3 gap-4">
                    <Stat
                      label="Connected clients"
                      value={routerStatus.connected_clients || 0}
                      tone="success"
                    />
                    <Stat
                      label="Active vouchers"
                      value={routerStatus.active_vouchers || 0}
                      tone="info"
                    />
                    <Stat
                      label="Uptime"
                      value={routerStatus.uptime ? `${Math.floor(routerStatus.uptime / 3600)}h` : '—'}
                      tone="money"
                    />
                  </div>
                ) : (
                  <Alert tone="danger">
                    <p>Router unreachable: {routerStatus.error || 'Unknown error'}</p>
                    <p className="text-xs opacity-80 mt-1.5">
                      Waiting for the router to push a status snapshot to /api/router/sync.
                      Ensure hotspot-sync-daemon is running and SYNC_API_KEY matches.
                    </p>
                  </Alert>
                )
              ) : (
                <EmptyState
                  title="No status yet"
                  description="Select a router and refresh to load the latest snapshot."
                  action={
                    <Button variant="secondary" size="sm" onClick={fetchRouter} disabled={routerLoading}>
                      {routerLoading ? 'Loading…' : 'Load status'}
                    </Button>
                  }
                />
              )}
              </CardBody>
            </Card>

            {/* Connected Clients */}
            <Card>
              <CardHeader
                title="Connected clients"
                description="Live devices from the router ARP/lease table"
              />
              <CardBody>
              {routerClients ? (
                <div className="space-y-2">
                  {parseClients(routerClients).map(c => {
                    const qos = qosDrafts[c.ip] || {
                      download: c.downloadKbps ? String(c.downloadKbps) : '',
                      upload: c.uploadKbps ? String(c.uploadKbps) : '',
                    };
                    const busy = deviceActionPending === c.ip;
                    return (
                      <div
                        key={c.ip}
                        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-4 min-w-0">
                            <span className="font-mono text-sm text-cyan-400">{c.mac || '—'}</span>
                            <span className="font-mono text-sm text-slate-400">{c.ip || '—'}</span>
                            {c.hostname && <span className="text-sm text-slate-300">{c.hostname}</span>}
                            {c.connectedAt && (
                              <span className="text-xs text-slate-500">
                                since {formatTime(c.connectedAt)}
                              </span>
                            )}
                            {(c.downloadKbps || c.uploadKbps) && (
                              <span className="text-xs text-slate-500 tabular">
                                {c.downloadKbps ?? '—'}↓ / {c.uploadKbps ?? '—'}↑ kbps
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleUnblockDevice(c.ip)}
                              disabled={busy}
                            >
                              Unblock
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleBlockDevice(c.ip)}
                              disabled={busy}
                            >
                              Ban
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="text-xs text-slate-500" htmlFor={`dl-${c.ip}`}>
                            Speed limit (kbps)
                          </label>
                          <input
                            id={`dl-${c.ip}`}
                            type="number"
                            min={64}
                            value={qos.download}
                            onChange={e =>
                              setQosDrafts(prev => ({
                                ...prev,
                                [c.ip]: { ...qos, download: e.target.value },
                              }))
                            }
                            className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 w-24 focus:border-cyan-500/60 focus:outline-none"
                            placeholder="Down"
                          />
                          <input
                            type="number"
                            min={64}
                            aria-label="Upload limit kbps"
                            value={qos.upload}
                            onChange={e =>
                              setQosDrafts(prev => ({
                                ...prev,
                                [c.ip]: { ...qos, upload: e.target.value },
                              }))
                            }
                            className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 w-24 focus:border-cyan-500/60 focus:outline-none"
                            placeholder="Up"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSetSpeed(c.ip)}
                            disabled={busy}
                          >
                            {busy ? 'Queuing…' : 'Set speed'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No clients"
                  description="No devices connected, or the router is unreachable."
                />
              )}
              </CardBody>
            </Card>

            {/* Active Vouchers on Router */}
            <Card>
              <CardHeader
                title="Active sessions"
                description="Voucher sessions currently authorized on the router"
              />
              <CardBody>
              {routerActive ? (
                <div className="space-y-2">
                  {routerActive.split('\n').filter(Boolean).map((line, i) => {
                    const parts = line.split(' ');
                    const busy = deviceActionPending === parts[0];
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 gap-3"
                      >
                        <div className="flex flex-wrap gap-4 text-sm min-w-0">
                          <span className="font-mono text-cyan-400">{parts[0] || '—'}</span>
                          <span className="font-mono text-slate-400">{parts[2] || '—'}</span>
                          <span className="text-slate-500">{parts[1] || '—'}</span>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleKickSession(parts[0])}
                          disabled={busy}
                        >
                          {busy ? 'Queuing…' : 'Kick'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No active sessions" description="Nothing authorized on the router right now." />
              )}
              </CardBody>
            </Card>
          </div>
        )}

        {activeTab === 'generate' && (
          <Card className="mb-6">
            <CardHeader
              title="Generate free vouchers"
              description="Issue complimentary codes without payment"
            />
            <CardBody>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
                <Select value={genPlan} onChange={e => setGenPlan(e.target.value)} className="w-auto">
                  <option value="trial">Trial (Free)</option>
                  <option value="hourly">Hourly (৳20)</option>
                  <option value="daily">Daily (৳50)</option>
                  <option value="weekly">Weekly (৳200)</option>
                  <option value="monthly">Monthly (৳500)</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="gen-count">
                  Count
                </label>
                <input
                  id="gen-count"
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={e => setGenCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 w-24 text-sm focus:border-cyan-500/60 focus:outline-none"
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="gen-note">
                  Note (optional)
                </label>
                <input
                  id="gen-note"
                  type="text"
                  value={genNote}
                  onChange={e => setGenNote(e.target.value)}
                  placeholder="e.g. promo, staff, giveaway"
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 w-full text-sm focus:border-cyan-500/60 focus:outline-none"
                />
              </div>
              <Button size="lg" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : 'Generate'}
              </Button>
            </div>

            {newCodes.length > 0 && (
              <Alert tone="success">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-medium">Generated {newCodes.length} voucher(s)</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(newCodes.join('\n')).catch(() => {});
                    }}
                  >
                    Copy all
                  </Button>
                </div>
                <div className="space-y-1">
                  {newCodes.map(code => (
                    <p key={code} className="font-mono font-bold tracking-wider select-all">
                      {code}
                    </p>
                  ))}
                </div>
              </Alert>
            )}
            </CardBody>
          </Card>
        )}

        {activeTab === 'discounts' && (
          <div className="space-y-6">
            <Card>
              <CardHeader title="Create discount code" description="Apply at checkout for guests" />
              <CardBody>
              {dcError && (
                <div className="mb-4">
                  <Alert tone="danger">{dcError}</Alert>
                </div>
              )}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                  <Select
                    value={dcType}
                    onChange={e => setDcType(e.target.value as 'percent' | 'fixed' | 'free')}
                    className="w-auto"
                  >
                    <option value="percent">Percent off</option>
                    <option value="fixed">Fixed BDT off</option>
                    <option value="free">Free (100% off)</option>
                  </Select>
                </div>
                {dcType !== 'free' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      {dcType === 'percent' ? 'Percent' : 'Amount (৳)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={dcType === 'percent' ? 100 : undefined}
                      value={dcValue}
                      onChange={e => setDcValue(Number(e.target.value) || 0)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 w-28 text-sm focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan (optional)</label>
                  <Select
                    value={dcPlan}
                    onChange={e => setDcPlan(e.target.value)}
                    className="w-auto"
                  >
                    <option value="">Any plan</option>
                    <option value="trial">Trial</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="dc-max">
                    Max uses
                  </label>
                  <input
                    id="dc-max"
                    type="number"
                    min={1}
                    value={dcMaxUses}
                    onChange={e => setDcMaxUses(Math.max(1, Number(e.target.value) || 1))}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 w-24 text-sm focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>
                <Button size="lg" onClick={handleCreateDiscount} disabled={dcCreating}>
                  {dcCreating ? 'Creating…' : 'Create'}
                </Button>
              </div>
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Discount codes" description={`${discountCodes.length} total`} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--muted)]">
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
                      <tr key={dc.code} className="border-b border-[var(--border)]/60 last:border-0 hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-cyan-400 select-all">{dc.code}</td>
                        <td className="px-4 py-3 capitalize text-slate-300">{dc.type}</td>
                        <td className="px-4 py-3 tabular">
                          {dc.type === 'percent' ? `${dc.value}%` : dc.type === 'free' ? 'Free' : `৳${dc.value}`}
                        </td>
                        <td className="px-4 py-3 capitalize">{dc.plan_id || 'Any'}</td>
                        <td className="px-4 py-3 tabular">{dc.used_count}/{dc.max_uses}</td>
                        <td className="px-4 py-3">
                          {dc.active ? (
                            <Badge tone="success">Active</Badge>
                          ) : (
                            <Badge tone="neutral">Disabled</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {dc.active ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeactivateDiscount(dc.code)}
                            >
                              Disable
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {discountCodes.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState
                            title="No discount codes yet"
                            description="Create one above to offer promotions at checkout."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'vouchers' && (
          <div>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="flex-1 min-w-48">
                <Field label="Search">
                  <Input
                    value={voucherQuery}
                    onChange={e => setVoucherQuery(e.target.value)}
                    placeholder="Code or plan…"
                    autoComplete="off"
                  />
                </Field>
              </div>
              <div className="w-36">
                <Field label="Status">
                  <Select
                    value={voucherStatus}
                    onChange={e =>
                      setVoucherStatus(e.target.value as 'all' | 'unused' | 'used')
                    }
                  >
                    <option value="all">All</option>
                    <option value="unused">Unused</option>
                    <option value="used">Used</option>
                  </Select>
                </Field>
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={handleExport}
                disabled={exporting || filteredVouchers.length === 0}
              >
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            </div>

            <Card className="overflow-hidden">
              <CardHeader
                title="Vouchers"
                description={`${filteredVouchers.length} of ${vouchers.length} shown`}
                actions={
                  <Button variant="ghost" size="sm" onClick={fetchData}>
                    Refresh
                  </Button>
                }
              />
              {filteredVouchers.length === 0 ? (
                <EmptyState
                  title={vouchers.length === 0 ? 'No vouchers yet' : 'No matches'}
                  description={
                    vouchers.length === 0
                      ? 'Generate vouchers from the Generate tab.'
                      : 'Adjust the search or status filter.'
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--muted)]">
                        <th className="px-4 py-3 font-medium">Code</th>
                        <th className="px-4 py-3 font-medium">Plan</th>
                        <th className="px-4 py-3 font-medium">Duration</th>
                        <th className="px-4 py-3 font-medium">Speed</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVouchers.map(v => (
                        <tr
                          key={v.code}
                          className="border-b border-[var(--border)]/60 last:border-0 hover:bg-slate-800/30"
                        >
                          <td className="px-4 py-3 font-mono text-cyan-400 select-all">
                            {v.code}
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-300">{v.plan_id}</td>
                          <td className="px-4 py-3 tabular">{formatDuration(v.duration_seconds)}</td>
                          <td className="px-4 py-3 tabular">{v.download_kbps / 1024} Mbps</td>
                          <td className="px-4 py-3">
                            {v.used ? (
                              <Badge tone="warning">Used</Badge>
                            ) : (
                              <Badge tone="success">Unused</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatTime(v.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'audit' && (
          <Card className="overflow-hidden">
            <CardHeader
              title="Audit log"
              description="Admin actions recorded on the server"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={auditLoading}
                  onClick={() => {
                    setAuditLoading(true);
                    fetch('/api/admin/audit')
                      .then(r => (r.ok ? r.json() : { logs: [] }))
                      .then(data => setAuditLogs(data.logs || []))
                      .catch(() => setAuditLogs([]))
                      .finally(() => setAuditLoading(false));
                  }}
                >
                  {auditLoading ? 'Refreshing…' : 'Refresh'}
                </Button>
              }
            />
            {auditLoading && auditLogs.length === 0 ? (
              <div className="p-8 flex justify-center">
                <Spinner className="text-cyan-400" />
              </div>
            ) : auditLogs.length === 0 ? (
              <EmptyState
                title="No audit entries yet"
                description="Generate a voucher, create a discount, or update a router to record activity."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--muted)]">
                      <th className="px-4 py-3 font-medium">When</th>
                      <th className="px-4 py-3 font-medium">Actor</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr
                        key={log.id}
                        className="border-b border-[var(--border)]/60 last:border-0"
                      >
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {formatTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{log.actor}</td>
                        <td className="px-4 py-3">
                          <Badge tone="info">{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {log.detail || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
