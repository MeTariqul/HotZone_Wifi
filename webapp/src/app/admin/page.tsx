'use client';

import { useState, useEffect } from 'react';
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

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  if (seconds < 604800) return `${seconds / 86400}d`;
  return `${seconds / 604800}w`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function AdminPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vouchers' | 'generate'>('vouchers');
  const [genPlan, setGenPlan] = useState('hourly');
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState('');

  const fetchData = () => {
    fetch('/api/vouchers')
      .then(r => r.json())
      .then(data => {
        setVouchers(data.vouchers);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const payRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: genPlan }),
      });
      const payData = await payRes.json();

      const confirmRes = await fetch('/api/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payData.paymentId }),
      });
      const confirmData = await confirmRes.json();

      setNewCode(confirmData.voucher.code);
      fetchData();
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-sky-400">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">Tarif Hotspot Management</p>
          </div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
            Public Site
          </Link>
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
        </div>

        {activeTab === 'generate' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Generate Voucher</h3>
            <div className="flex gap-4 items-end">
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
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {newCode && (
              <div className="mt-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Generated voucher:</p>
                <p className="text-xl font-mono font-bold text-emerald-400 tracking-wider">{newCode}</p>
              </div>
            )}
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
