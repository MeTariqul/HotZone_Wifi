'use client';

import { useState, useEffect } from 'react';
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
  if (seconds < 3600) return `${seconds / 60} min`;
  if (seconds < 86400) return `${seconds / 3600} hour`;
  if (seconds < 604800) return `${seconds / 86400} day`;
  return `${seconds / 604800} week`;
}

function formatSpeed(kbps: number): string {
  if (kbps >= 1024) return `${kbps / 1024} Mbps`;
  return `${kbps} Kbps`;
}

export default function HomePage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(setPlans)
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sky-400">Tarif</h1>
            <p className="text-xs text-slate-500">Internet Hotspot</p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Choose a Plan</h2>
          <p className="text-slate-400">
            Select a plan, pay with bKash or Nagad, and get instant WiFi access.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="group relative bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-sky-500/50 transition-all duration-200"
            >
              {plan.price_bdt === 0 && (
                <span className="absolute -top-3 left-6 bg-emerald-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                  FREE
                </span>
              )}
              <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
              <p className="text-3xl font-bold text-sky-400 mb-4">
                {plan.price_bdt === 0 ? 'Free' : `৳${plan.price_bdt}`}
              </p>

              <ul className="space-y-2 mb-6 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDuration(plan.duration_seconds)}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Download: {formatSpeed(plan.download_kbps)}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Upload: {formatSpeed(plan.upload_kbps)}
                </li>
              </ul>

              <Link
                href={`/pay?plan=${plan.id}`}
                className="block w-full text-center bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {plan.price_bdt === 0 ? 'Get Free Voucher' : 'Buy Now'}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center text-sm text-slate-600">
          <p>After payment, you will receive a voucher code.</p>
          <p>Connect to WiFi and enter the code on the splash page.</p>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        Tarif Hotspot &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
