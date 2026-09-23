'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, CardBody, Field, Input, Spinner } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  price_bdt: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${seconds / 60} minutes`;
  if (seconds < 86400) return `${seconds / 3600} hours`;
  if (seconds < 604800) return `${seconds / 86400} days`;
  return `${seconds / 604800} weeks`;
}

function formatSpeed(kbps: number): string {
  if (kbps >= 1024) return `${kbps / 1024} Mbps`;
  return `${kbps} Kbps`;
}

function PayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan');

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  useEffect(() => {
    if (!planId) {
      router.replace('/');
      return;
    }
    fetch('/api/plans')
      .then(r => r.json())
      .then((plans: Plan[]) => {
        const found = plans.find(p => p.id === planId);
        if (found) setPlan(found);
        else setError('Plan not found. Choose another plan from the home page.');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load plan. Go back and try again.');
        setLoading(false);
      });
  }, [planId, router]);

  const handleApplyDiscount = async () => {
    if (!plan || !discountInput.trim()) return;
    setCheckingDiscount(true);
    setDiscountError('');
    try {
      const res = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountInput.trim(), planId: plan.id }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({
          code: discountInput.trim().toUpperCase(),
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount,
        });
      } else {
        setAppliedDiscount(null);
        setDiscountError(data.error || 'Invalid discount code');
      }
    } catch {
      setAppliedDiscount(null);
      setDiscountError('Failed to check discount code');
    }
    setCheckingDiscount(false);
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountInput('');
    setDiscountError('');
  };

  const amountToPay = appliedDiscount ? appliedDiscount.finalAmount : plan?.price_bdt ?? 0;

  const completeCheckout = async (withDelay: boolean) => {
    if (!plan) return;
    setProcessing(true);
    setError('');
    try {
      const payRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          discountCode: appliedDiscount?.code,
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'Payment creation failed');

      if (withDelay && payData.amount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1400));
      }

      const confirmRes = await fetch('/api/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payData.paymentId }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || 'Voucher generation failed');

      router.push(
        `/success?code=${encodeURIComponent(confirmData.voucher.code)}&plan=${encodeURIComponent(confirmData.voucher.plan)}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-slate-400">
        <Spinner /> Loading plan…
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <Alert tone="danger">{error}</Alert>
        <Link href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
          Back to plans
        </Link>
      </div>
    );
  }

  const free = plan?.price_bdt === 0 || amountToPay === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="signal-rule" />
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/70">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-cyan-300">
            ← Plans
          </Link>
          <span className="text-xs text-slate-500">Checkout</span>
        </div>
      </header>

      <main id="main" className="flex-1 max-w-xl mx-auto px-5 py-10 w-full">
        <Card>
          <CardBody className="space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
                Order summary
              </p>
              <h1 className="text-2xl font-bold mt-1">{plan?.name}</h1>
              <p className="text-sm text-slate-400 mt-1">
                {plan ? formatDuration(plan.duration_seconds) : ''} ·{' '}
                {plan ? formatSpeed(plan.download_kbps) : ''} down ·{' '}
                {plan ? formatSpeed(plan.upload_kbps) : ''} up
              </p>
            </div>

            <div className="bg-slate-900/60 border border-[var(--border)] rounded-lg p-5 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Amount due</span>
                <span className="text-3xl font-bold text-cyan-400 tabular">
                  {amountToPay === 0 ? 'Free' : (
                    <>
                      <span className="text-xl text-amber-400">৳</span>
                      {amountToPay}
                    </>
                  )}
                </span>
              </div>
              {appliedDiscount && (
                <>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>List price</span>
                    <span className="line-through tabular">৳{plan?.price_bdt}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-400">
                    <span>Discount · {appliedDiscount.code}</span>
                    <span className="tabular">−৳{appliedDiscount.discountAmount}</span>
                  </div>
                </>
              )}
              {plan && plan.price_bdt > 0 && amountToPay > 0 && (
                <p className="text-xs text-slate-500 pt-1">
                  Payment method: bKash / Nagad (demo — no real charge)
                </p>
              )}
              {amountToPay === 0 && plan && plan.price_bdt !== 0 && (
                <p className="text-xs text-emerald-400 pt-1">
                  Discount covers the full amount.
                </p>
              )}
            </div>

            {plan && plan.price_bdt > 0 && (
              <div>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between gap-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-emerald-300 truncate">
                        {appliedDiscount.code}
                      </p>
                      <p className="text-xs text-emerald-400/80">
                        Saves ৳{appliedDiscount.discountAmount}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleRemoveDiscount}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Field label="Discount code" error={discountError || undefined}>
                    <div className="flex gap-2">
                      <Input
                        value={discountInput}
                        onChange={e => setDiscountInput(e.target.value.toUpperCase())}
                        placeholder="e.g. SAVE10"
                        autoComplete="off"
                        aria-label="Discount code"
                      />
                      <Button
                        variant="secondary"
                        onClick={handleApplyDiscount}
                        disabled={checkingDiscount || !discountInput.trim()}
                      >
                        {checkingDiscount ? 'Checking…' : 'Apply'}
                      </Button>
                    </div>
                  </Field>
                )}
              </div>
            )}

            {error && <Alert tone="danger">{error}</Alert>}

            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                variant={free ? 'success' : 'primary'}
                disabled={processing}
                onClick={() => completeCheckout(!free)}
              >
                {processing ? (
                  <>
                    <Spinner /> {free ? 'Issuing voucher…' : 'Processing…'}
                  </>
                ) : free ? (
                  'Get free voucher'
                ) : (
                  `Pay ৳${amountToPay} (demo)`
                )}
              </Button>
              <p className="text-[11px] text-slate-600 text-center">
                Demo checkout — no real payment is processed.
              </p>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          <Spinner /> <span className="ml-2">Loading…</span>
        </div>
      }
    >
      <PayContent />
    </Suspense>
  );
}
