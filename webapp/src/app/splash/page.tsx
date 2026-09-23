'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Plan {
  id: string;
  name: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  price_bdt: number;
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
  const [planInfo, setPlanInfo] = useState<{ plan: string; duration: number; download: number; upload: number } | null>(null);
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

        // Authorize directly on router (client is on LAN)
        if (clientIp) {
          try {
            const authorizeUrl = `http://${routerHost}/cgi-bin/hotspot?authorize&secret=${encodeURIComponent(routerSecret)}`;
            await fetch(authorizeUrl, {
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
          } catch {
            // Fallback: try via Vercel API
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Connected!</h1>
          <p className="text-gray-600 mb-6">You now have internet access.</p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan</span>
              <span className="font-semibold text-gray-900 capitalize">{planInfo.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration</span>
              <span className="font-semibold text-gray-900">
                {planInfo.duration < 3600
                  ? `${Math.floor(planInfo.duration / 60)} minutes`
                  : planInfo.duration < 86400
                    ? `${Math.floor(planInfo.duration / 3600)} hours`
                    : `${Math.floor(planInfo.duration / 86400)} days`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Speed</span>
              <span className="font-semibold text-gray-900">
                {Math.floor(planInfo.download / 1024)} Mbps / {Math.floor(planInfo.upload / 1024)} Mbps
              </span>
            </div>
          </div>

          <button
            onClick={() => setResult(null)}
            className="mt-6 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Enter another code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📡</div>
            <h1 className="text-2xl font-bold text-gray-900">HotZone WiFi</h1>
            <p className="text-gray-500 mt-1">Enter your voucher code to connect</p>
          </div>

          {result === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Voucher Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="T-XXXX-XXXX"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-lg font-mono tracking-widest uppercase focus:border-blue-500 focus:outline-none text-center"
                autoComplete="off"
                required
              />
            </div>
            <button
              type="submit"
              disabled={verifying || !code.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-lg transition-colors text-lg"
            >
              {verifying ? 'Verifying...' : 'Connect'}
            </button>
          </form>

          {plans.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">Available Plans</p>
              <div className="grid grid-cols-2 gap-2">
                {plans.map(plan => (
                  <div key={plan.id} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="font-semibold text-gray-900 text-sm">{plan.name}</p>
                    <p className="text-blue-600 font-bold">
                      {plan.price_bdt === 0 ? 'Free' : `৳${plan.price_bdt}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {plan.duration_seconds < 3600
                        ? `${Math.floor(plan.duration_seconds / 60)}m`
                        : plan.duration_seconds < 86400
                          ? `${Math.floor(plan.duration_seconds / 3600)}h`
                          : `${Math.floor(plan.duration_seconds / 86400)}d`}
                      {' · '}
                      {Math.floor(plan.download_kbps / 1024)}Mbps
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Need a voucher? Contact admin or visit our website.
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
