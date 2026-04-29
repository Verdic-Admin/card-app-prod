'use client';

import { useState } from 'react';

interface AutoUpdateBannerProps {
  adminPassword?: string;
}

export function AutoUpdateBanner({ adminPassword }: AutoUpdateBannerProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);

  if (done) return null;

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/acknowledge-updates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminPassword ? { 'x-admin-password': adminPassword } : {}),
        },
      });
      setDone(true);
    } catch {
      // non-fatal — let them try again
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-amber-950 border-b border-amber-500/40 px-4 py-0">
      <div className="max-w-5xl mx-auto">

        {/* ── Collapsed header — always visible ───────────────────────── */}
        <button
          type="button"
          onClick={() => setConfirming((v) => !v)}
          className="w-full flex items-center gap-3 py-3 text-left group"
        >
          <span className="text-amber-400 text-lg shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <span className="text-amber-200 font-bold text-sm">
              Action Required: Auto-Updates Disabled
            </span>
            <span className="text-amber-400/70 text-xs ml-2 hidden sm:inline">
              — You will not receive new features or security patches until this is enabled.
            </span>
          </div>
          <span className="text-amber-400/60 text-xs shrink-0 group-hover:text-amber-300 transition-colors">
            {confirming ? 'Hide ▲' : 'How to fix ▼'}
          </span>
        </button>

        {/* ── Expanded instructions ────────────────────────────────────── */}
        {confirming && (
          <div className="pb-5 flex flex-col gap-5">

            {/* Warning */}
            <p className="text-amber-300/80 text-xs leading-relaxed border-t border-amber-500/20 pt-4">
              Your store is live, but Railway does not know to check for updates. Enable Image Auto Updates
              once and Railway will automatically pull new versions of your store with zero downtime — no action
              required from you ever again.
            </p>

            {/* Steps */}
            <div className="bg-amber-950/60 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-amber-200 font-bold text-sm">Enable in 3 steps (takes ~30 seconds):</p>

              {[
                <>
                  Open your{' '}
                  <a
                    href="https://railway.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 underline hover:text-amber-300"
                  >
                    Railway dashboard
                  </a>{' '}
                  → click on your <strong className="text-amber-100">card-app-prod</strong> service → go to{' '}
                  <strong className="text-amber-100">Settings</strong>
                </>,
                <>
                  Scroll down to the <strong className="text-amber-100">Source</strong> section → click{' '}
                  <strong className="text-amber-100">Configure Auto Updates</strong>
                </>,
                <>
                  Select <strong className="text-amber-100">Minor updates &amp; patches</strong> and set the
                  Maintenance Window to <strong className="text-amber-100">Anytime</strong> → Save
                </>,
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-amber-300/80 text-xs leading-relaxed">{step}</p>
                </div>
              ))}
            </div>

            {/* Acknowledgment button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={loading}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-800 disabled:text-amber-500 text-amber-950 font-bold text-sm rounded-xl transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)]"
              >
                {loading ? 'Saving…' : '✅ I have enabled Auto-Updates in Railway'}
              </button>
              <a
                href="https://playerindexdata.com/update-instructions.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 underline hover:text-amber-300 text-xs font-bold"
              >
                View full update instructions →
              </a>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
