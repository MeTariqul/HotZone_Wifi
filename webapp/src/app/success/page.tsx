'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardBody } from '@/components/ui';

function SuccessContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const plan = searchParams.get('plan') || '';
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setCopyErr(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyErr(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardBody className="text-center space-y-5">
            <div>
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <Badge tone="success" className="mb-3">
                Payment complete
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight">Your voucher is ready</h1>
              <p className="text-sm text-slate-400 mt-1.5">
                {plan ? `${plan} plan · ` : ''}Redeem this code on the WiFi splash page.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-[var(--border)] rounded-lg p-5">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
                Voucher code
              </p>
              <p className="code-display text-2xl font-bold text-cyan-400 select-all break-all">
                {code || '—'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center no-print">
                <Button variant="secondary" size="sm" onClick={copyCode} disabled={!code}>
                  {copied ? 'Copied' : 'Copy code'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.print()}
                >
                  Print / save PDF
                </Button>
              </div>
              {copyErr && (
                <p className="text-xs text-amber-400 mt-2">
                  Clipboard blocked — select the code and copy manually.
                </p>
              )}
            </div>

            <div className="text-left bg-slate-900/40 border border-[var(--border)] rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-2">How to connect</h2>
              <ol className="text-sm text-slate-400 space-y-1.5 list-decimal list-inside">
                <li>
                  Connect to WiFi <strong className="text-slate-200">Tarif</strong>
                </li>
                <li>Open any website in your browser</li>
                <li>Enter the voucher code above</li>
                <li>
                  Tap <strong className="text-slate-200">Connect</strong>
                </li>
              </ol>
            </div>

            <Alert tone="warning">
              Save this code. You can redeem it again if your session expires before the plan
              time runs out.
            </Alert>

            <div className="flex flex-col gap-2 no-print">
              <Link href="/" className="w-full">
                <Button className="w-full" variant="secondary">
                  Buy another voucher
                </Button>
              </Link>
              <Link
                href="/splash"
                className="text-sm text-cyan-400 hover:text-cyan-300 text-center"
              >
                Already on WiFi? Redeem now →
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
