import { Suspense } from 'react';
import { Coins, ExternalLink } from 'lucide-react';
import { submitOracleRequest } from '@/app/actions/oracleAPI';
import { PLAYER_INDEX_BILLING_URL } from '@/lib/player-index-urls';
import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';

async function CreditsInner() {
  let balance: number | null = null;
  let showUnavailable = true;

  try {
    const base = await getOracleGatewayBaseUrl();
    const res = await submitOracleRequest(`${base}/account/balance`);
    const data = res.success && res.data ? (res.data as Record<string, unknown>) : null;
    balance =
      res.success && data != null && data.token_balance != null ? Number(data.token_balance) : null;
    showUnavailable = !res.success || data == null || balance === null;
  } catch (error) {
    // Never let this status banner break /admin route rendering.
    console.error('[AdminApiCreditsStrip] failed to render credits:', error);
    balance = null;
    showUnavailable = true;
  }

  return (
    <div className="border-b border-border bg-surface/90 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Coins className="w-4 h-4 text-brand shrink-0" aria-hidden />
          <span className="font-bold text-muted shrink-0">Player Index Tokens</span>
          {showUnavailable ? (
            <span className="text-muted font-medium truncate">Balance unavailable</span>
          ) : (
            <span className="font-black text-foreground tabular-nums">
              {balance!.toLocaleString()}
              <span className="text-muted font-semibold text-xs ml-1.5">remaining</span>
            </span>
          )}
        </div>
        <a
          href={PLAYER_INDEX_BILLING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-background text-xs font-black uppercase tracking-wide hover:opacity-90 shrink-0"
        >
          Refill / Subscribe
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}

export function AdminApiCreditsStrip() {
  return (
    <Suspense
      fallback={
        <div
          className="h-11 border-b border-border bg-surface/50 animate-pulse"
          aria-hidden
        />
      }
    >
      <CreditsInner />
    </Suspense>
  );
}
