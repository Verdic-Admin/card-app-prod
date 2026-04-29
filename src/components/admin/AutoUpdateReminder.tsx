'use client';

import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';

const DISMISS_KEY = 'auto-update-reminder-dismissed';

/**
 * AutoUpdateReminder — a dismissable banner nudging store owners
 * to enable auto-deploy so they always get the latest platform updates.
 * Dismissal is persisted in localStorage.
 */
export function AutoUpdateReminder() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't dismissed it
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative bg-gradient-to-r from-brand/10 via-brand/5 to-transparent border border-brand/20 rounded-xl px-5 py-3.5 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
      <div className="p-1.5 bg-brand/15 rounded-lg shrink-0 mt-0.5">
        <Info className="w-4 h-4 text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">
          Platform updates are available
        </p>
        <p className="text-xs text-muted font-medium mt-0.5 leading-relaxed">
          Go to your service → Settings → enable &quot;Auto Deploy&quot; on the main branch.{' '}
          <a href="https://playerindexdata.com/update-instructions.pdf" target="_blank" rel="noopener noreferrer" className="underline text-brand font-bold hover:opacity-80">View full update instructions →</a>
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition"
        aria-label="Dismiss reminder"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
