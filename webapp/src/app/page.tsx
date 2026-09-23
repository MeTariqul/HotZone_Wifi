'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Badge, Spinner } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  price_bdt: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${seconds / 60} min`;
  if (seconds < 86400) return `${seconds / 3600} hour${seconds >= 7200 ? 's' : ''}`;
  if (seconds < 604800) return `${seconds / 86400} day${seconds >= 172800 ? 's' : ''}`;
  return `${seconds / 604800} week${seconds >= 1209600 ? 's' : ''}`;
}

function formatSpeed(kbps: number): string {
  if (kbps >= 1024) {
    const m = kbps / 1024;
    return `${Number.isInteger(m) ? m : m.toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

function planBlurb(plan: Plan): string {
  switch (plan.id) {
    case 'trial':
      return 'Try the network free — no payment required.';
    case 'hourly':
      return 'Quick session for a visit or short stay.';
    case 'daily':
      return 'Full-day access for work or streaming.';
    case 'weekly':
      return 'Best value for a week of reliable WiFi.';
    case 'monthly':
      return 'Resident plan — maximum time, high speed.';
    default:
      return `${formatDuration(plan.duration_seconds)} of internet access.`;
  }
}

export default function HomePage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then((data: Plan[]) => {
        setPlans(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load plans. Refresh the page to try again.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="signal-rule" />
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-400">
              Tarif
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-50">Hotspot</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a
              href="#plans"
              className="text-slate-400 hover:text-cyan-300 transition-colors"
            >
              Plans
            </a>
            <Link
              href="/splash"
              className="text-slate-400 hover:text-cyan-300 transition-colors"
            >
              Redeem
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1 max-w-5xl mx-auto px-5 sm:px-6 py-12 w-full">
        <section className="max-w-2xl mb-12">
          <Badge tone="info" className="mb-4">
            Captive portal · instant voucher
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Internet access, paid in minutes.
          </h2>
          <p className="text-slate-400 mt-3 text-base leading-relaxed max-w-xl">
            Choose a plan, complete payment, and redeem your code on the WiFi splash page.
            No account required.
          </p>
        </section>

        <section id="plans" aria-label="Available plans">
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy>
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton h-64 rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div
              className="border border-rose-800/60 bg-rose-950/40 text-rose-200 rounded-lg px-4 py-3 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          {!loading && !error && plans.length === 0 && (
            <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
              No plans are published yet. Check back soon.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map(plan => {
              const free = plan.price_bdt === 0;
              const popular = plan.id === 'daily';
              return (
                <article
                  key={plan.id}
                  className={`relative flex flex-col bg-[var(--surface)] border rounded-xl p-6 transition-colors ${
                    popular
                      ? 'border-cyan-500/40 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                      : 'border-[var(--border)] hover:border-slate-600'
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-2.5 left-5 bg-cyan-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      Popular
                    </span>
                  )}
                  {free && (
                    <span className="absolute -top-2.5 left-5 bg-emerald-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      Free
                    </span>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {planBlurb(plan)}
                    </p>
                  </div>

                  <p className="text-3xl font-bold text-cyan-400 tabular mb-5">
                    {free ? 'Free' : (
                      <>
                        <span className="text-xl align-top text-amber-400">৳</span>
                        {plan.price_bdt}
                      </>
                    )}
                  </p>

                  <ul className="space-y-2.5 mb-6 text-sm text-slate-400 flex-1">
                    <li className="flex items-start gap-2.5">
                      <span className="text-cyan-500 mt-0.5" aria-hidden>
                        ◷
                      </span>
                      <span>{formatDuration(plan.duration_seconds)} access</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-cyan-500 mt-0.5" aria-hidden>
                        ↓
                      </span>
                      <span>Download up to {formatSpeed(plan.download_kbps)}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-cyan-500 mt-0.5" aria-hidden>
                        ↑
                      </span>
                      <span>Upload up to {formatSpeed(plan.upload_kbps)}</span>
                    </li>
                  </ul>

                  <Button
                    className="w-full"
                    size="md"
                    variant={free ? 'success' : 'primary'}
                    onClick={() => router.push(`/pay?plan=${plan.id}`)}
                  >
                    {free ? 'Get free voucher' : 'Buy now'}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-14 grid sm:grid-cols-3 gap-4">
          {[
            {
              t: '1. Buy',
              d: 'Pick a plan and pay with bKash or Nagad (demo gateway).',
            },
            {
              t: '2. Get code',
              d: 'Your voucher code appears immediately — save or screenshot it.',
            },
            {
              t: '3. Connect',
              d: 'Join WiFi “Tarif”, open any site, enter the code on the splash page.',
            },
          ].map(step => (
            <div
              key={step.t}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500 mb-2">
                {step.t}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">{step.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-6">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>Tarif Hotspot · {new Date().getFullYear()}</span>
          <span className="text-slate-500">Need help? Ask site staff for a voucher.</span>
        </div>
      </footer>

      {loading && <Spinner className="hidden" />}
    </div>
  );
}
