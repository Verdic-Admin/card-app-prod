'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion?: string;
  latestVersion?: string;
  latestMessage?: string;
  latestDate?: string;
  message?: string;
}

/**
 * PlatformUpdateBanner — renders in the admin dashboard.
 * Checks the upstream master template for new versions and lets
 * the shop admin trigger a rebuild with one click via Master Server.
 */
export function PlatformUpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    setIsChecking(true);
    try {
      const res = await fetch('/api/platform/check-update');
      const data = await res.json();
      setUpdateInfo(data);
    } catch {
      setUpdateInfo({ updateAvailable: false, message: 'Could not check for updates.' });
    } finally {
      setIsChecking(false);
    }
  }

  async function triggerUpdate() {
    setIsUpdating(true);
    setUpdateResult(null);
    try {
      const res = await fetch('/api/platform/trigger-update', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setUpdateResult({ type: 'success', text: data.message });
      } else {
        setUpdateResult({ type: 'error', text: data.error || 'Failed to trigger update.' });
      }
    } catch {
      setUpdateResult({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsUpdating(false);
    }
  }

  // Loading state
  if (isChecking) return null;

  // No update available — show compact current version
  if (!updateInfo?.updateAvailable) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span>Platform v{updateInfo?.currentVersion || '—'} · Up to date</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Update Available Banner */}
      {updateInfo?.updateAvailable && (
        <div className="bg-gradient-to-r from-indigo-600/15 to-cyan-600/10 border border-indigo-500/30 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="bg-indigo-500/20 p-2 rounded-lg shrink-0 mt-0.5">
                <Download className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Platform Update Available
                  <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    {updateInfo.currentVersion} → {updateInfo.latestVersion}
                  </span>
                </h3>
                <p className="text-xs text-muted mt-0.5 font-medium">
                  {updateInfo.latestMessage || 'New features and improvements are available.'}
                </p>
              </div>
            </div>
            <button
              onClick={triggerUpdate}
              disabled={isUpdating}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold text-sm rounded-lg transition-all shadow-md"
            >
              {isUpdating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isUpdating ? 'Updating…' : 'Update Now'}
            </button>
          </div>
        </div>
      )}

      {/* Update result feedback */}
      {updateResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-bold mb-4 ${
          updateResult.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {updateResult.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {updateResult.text}
        </div>
      )}
    </div>
  );
}
