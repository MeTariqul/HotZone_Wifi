'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Badge, Alert, Spinner } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  price_bdt: number;
}

function formatShortDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${seconds >= 7200 ? 's' : ''}`;
  return `${Math.floor(seconds / 86400)} day${seconds >= 172800 ? 's' : ''}`;
}

function formatSpeed(kbps: number): string {
  if (kbps >= 1024) {
    const m = kbps / 1024;
    return `${Number.isInteger(m) ? m : m.toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

function SplashContent() {
  const searchParams = useSearchParams();
  const clientIp = searchParams.get('ip') || '';
  const clientMac = searchParams.get('mac') || '';
  const routerHost = searchParams.get('router') || '192.168.1.1';
  const routerSecret = searchParams.get('secret') || '';

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const [planInfo, setPlanInfo] = useState<{
    plan: string;
    duration: number;
    download: number;
    upload: number;
  } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(setPlans)
      .catch(() => {});
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true);
    setResult(null);

    try {
      const res = await fetch('/api/vouchers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();

      if (data.valid) {
        setPlanInfo({
          plan: data.plan,
          duration: data.duration,
          download: data.download,
          upload: data.upload,
        });

        if (clientIp && routerSecret) {
          try {
            const authorizeUrl = `http://${routerHost}/cgi-bin/hotspot?authorize`;
            await fetch(authorizeUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${routerSecret}`,
              },
              body: JSON.stringify({
                code: data.code,
                ip: clientIp,
                mac: clientMac,
                duration: data.duration,
                download: data.download,
                upload: data.upload,
              }),
            });
          } catch {
            await fetch('/api/vouchers/authorize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: data.code,
                ip: clientIp,
                mac: clientMac,
                duration: data.duration,
                download: data.download,
                upload: data.upload,
              }),
            });
          }
        }

        setResult('success');
        setMessage('Connected! You now have internet access.');
      } else {
        setResult('error');
        setMessage(data.error || 'Invalid voucher code');
      }
    } catch {
      setResult('error');
      setMessage('Connection failed. Please try again.');
    }
    setVerifying(false);
  };

  if (result === 'success' && planInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="signal-rule fixed top-0 inset-x-0" />
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <Badge tone="success" className="mb-3">
              Session active
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">You&apos;re connected</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Keep this page bookmarked to check remaining time.
            </p>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Plan</dt>
                <dd className="font-semibold text-slate-100 capitalize">{planInfo.plan}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Duration</dt>
                <dd className="font-semibold text-slate-100">
                  {formatShortDuration(planInfo.duration)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Speed</dt>
                <dd className="font-semibold text-slate-100">
                  {formatSpeed(planInfo.download)} ↓ / {formatSpeed(planInfo.upload)} ↑
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setResult(null)}
              >
                Enter another code
              </Button>
              <Link
                href="/"
                className="block text-center text-xs text-slate-500 hover:text-cyan-300 transition-colors py-1"
              >
                View plans to buy another voucher
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="signal-rule" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-400 mb-2">
              Tarif
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Hotspot login</h1>
            <p className="text-sm text-[var(--muted)] mt-1.5">
              Enter your voucher code to go online
            </p>
          </div>

          {result === 'error' && (
            <Alert tone="danger" >
              {message}
            </Alert>
          )}

          <form
            onSubmit={handleVerify}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-4 mt-4"
          >
            <label htmlFor="code" className="block">
              <span className="block text-xs font-medium text-slate-400 mb-1.5">
                Voucher code
              </span>
              <input
                id="code"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="T-XXXX-XXXX"
                className="w-full bg-slate-900/80 border border-slate-700 text-slate-100 rounded-lg px-3.5 py-3 text-lg font-mono tracking-widest uppercase text-center placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-sans focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                autoComplete="off"
                required
              />
            </label>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={verifying || !code.trim()}
            >
              {verifying ? (
                <>
                  <Spinner />
                  Verifying…
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </form>

          {plans.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500 mb-3">
                Plans
              </p>
              <div className="grid grid-cols-2 gap-2">
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5"
                  >
                    <p className="text-xs font-medium text-slate-300">{plan.name}</p>
                    <p className="text-sm font-bold text-cyan-400 tabular">
                      {plan.price_bdt === 0 ? 'Free' : `৳${plan.price_bdt}`}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatShortDuration(plan.duration_seconds)}
                      {' · '}
                      {formatSpeed(plan.download_kbps)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-600 mt-6">
            Need a voucher?{' '}
            <Link href="/" className="text-slate-500 hover:text-cyan-300 underline underline-offset-2">
              Buy one online
            </Link>{' '}
            or ask site staff.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SplashPage() {
  return (
    <Suspense>
      <SplashContent />
    </Suspense>
  );
}
