'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const plan = searchParams.get('plan') || '';

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
        <p className="text-slate-400 mb-6">Your voucher code is ready</p>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Voucher Code</p>
          <p className="text-2xl font-mono font-bold text-sky-400 tracking-wider select-all">
            {code}
          </p>
        </div>

        <div className="bg-slate-800/30 rounded-lg p-4 mb-6 text-left">
          <h3 className="text-sm font-semibold mb-2">How to connect:</h3>
          <ol className="text-sm text-slate-400 space-y-1.5 list-decimal list-inside">
            <li>Connect to WiFi <strong className="text-slate-300">Tarif</strong></li>
            <li>Open any website in your browser</li>
            <li>Enter the voucher code above</li>
            <li>Tap <strong className="text-slate-300">Connect</strong></li>
          </ol>
        </div>

        <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 mb-6">
          <p className="text-xs text-amber-300">
            Save this code! You can use it again if your session expires.
          </p>
        </div>

        <Link
          href="/"
          className="block w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          Buy Another Voucher
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
