'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
      router.push('/');
      return;
    }
    fetch('/api/plans')
      .then(r => r.json())
      .then((plans: Plan[]) => {
        const found = plans.find(p => p.id === planId);
        if (found) {
          setPlan(found);
        } else {
          setError('Plan not found');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load plan');
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

  const handlePayment = async () => {
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

      if (!payRes.ok) {
        throw new Error(payData.error || 'Payment creation failed');
      }

      if (payData.amount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const confirmRes = await fetch('/api/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payData.paymentId }),
      });
      const confirmData = await confirmRes.json();

      if (!confirmRes.ok) {
        throw new Error(confirmData.error || 'Voucher generation failed');
      }

      router.push(`/success?code=${confirmData.voucher.code}&plan=${confirmData.voucher.plan}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setProcessing(false);
    }
  };

  const handleFreePlan = async () => {
    if (!plan) return;
    setProcessing(true);

    try {
      const payRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, discountCode: appliedDiscount?.code }),
      });
      const payData = await payRes.json();

      const confirmRes = await fetch('/api/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payData.paymentId }),
      });
      const confirmData = await confirmRes.json();

      router.push(`/success?code=${confirmData.voucher.code}&plan=${confirmData.voucher.plan}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
            &larr; Back to plans
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-2">Purchase: {plan?.name}</h2>
          <p className="text-slate-400 mb-6">
            {plan && formatDuration(plan.duration_seconds)} access at{' '}
            {plan && plan.download_kbps >= 1024
              ? `${plan.download_kbps / 1024} Mbps`
              : `${plan?.download_kbps} Kbps`} download
          </p>

          <div className="bg-slate-800/50 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400">Amount</span>
              <span className="text-3xl font-bold text-sky-400">
                {amountToPay === 0 ? 'Free' : `৳${amountToPay}`}
              </span>
            </div>
            {appliedDiscount && (
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-slate-500">Original</span>
                <span className="text-slate-500 line-through">৳{plan?.price_bdt}</span>
              </div>
            )}
            {appliedDiscount && (
              <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-emerald-400">Discount ({appliedDiscount.code})</span>
                <span className="text-emerald-400">-৳{appliedDiscount.discountAmount}</span>
              </div>
            )}
            {plan?.price_bdt !== 0 && amountToPay > 0 && (
              <p className="text-xs text-slate-500">
                Payment via bKash / Nagad (Demo Mode)
              </p>
            )}
            {amountToPay === 0 && plan?.price_bdt !== 0 && (
              <p className="text-xs text-emerald-400">
                Discount covers full amount — free voucher
              </p>
            )}
          </div>

          {plan && plan.price_bdt > 0 && (
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-1">Discount Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  disabled={!!appliedDiscount}
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 focus:border-sky-500 focus:outline-none"
                />
                {appliedDiscount ? (
                  <button
                    onClick={handleRemoveDiscount}
                    className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={handleApplyDiscount}
                    disabled={checkingDiscount || !discountInput.trim()}
                    className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    {checkingDiscount ? 'Checking...' : 'Apply'}
                  </button>
                )}
              </div>
              {discountError && (
                <p className="text-xs text-red-400 mt-1">{discountError}</p>
              )}
              {appliedDiscount && (
                <p className="text-xs text-emerald-400 mt-1">
                  Code applied — you save ৳{appliedDiscount.discountAmount}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 mb-6 text-sm">
              {error}
            </div>
          )}

          {plan?.price_bdt === 0 || amountToPay === 0 ? (
            <button
              onClick={handleFreePlan}
              disabled={processing}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {processing ? 'Generating...' : 'Get Free Voucher'}
            </button>
          ) : (
            <button
              onClick={handlePayment}
              disabled={processing}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing Payment...
                </span>
              ) : (
                `Pay ৳${amountToPay} (Demo)`
              )}
            </button>
          )}

          <p className="text-xs text-slate-600 text-center mt-4">
            Demo mode: No real payment is processed
          </p>
        </div>
      </main>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <PayContent />
    </Suspense>
  );
}
