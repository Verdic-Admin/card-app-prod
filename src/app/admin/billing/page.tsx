import Link from 'next/link';
import { submitOracleRequest } from '@/app/actions/oracleAPI';
import { PLAYER_INDEX_BILLING_URL } from '@/lib/player-index-urls';
import { Coins, TrendingUp, Star, Mail, ExternalLink } from 'lucide-react';

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.playerindexdata.com';

async function getAccountBalance() {
  try {
    const resp = await submitOracleRequest(`${API_BASE_URL}/fintech/account/balance`);
    if (!resp.success) return null;
    return resp.data;
  } catch {
    return null;
  }
}

const TIER_RATES: Record<string, { price: string; tokens: number; label: string }> = {
  basic: { price: '—', tokens: 50, label: 'Starter' },
  standard: { price: '$9', tokens: 1000, label: 'Standard' },
  pro: { price: '$29', tokens: 5000, label: 'Pro' },
  enterprise: { price: '$99', tokens: 25000, label: 'Enterprise' },
};

export default async function BillingPage() {
  const account = await getAccountBalance();

  const tier = account?.tier ?? 'standard';
  const billingExempt = !!(account as { billing_exempt?: boolean } | null)?.billing_exempt;
  const balance = billingExempt ? 0 : Number(account?.token_balance ?? 0);
  const clientName = account?.client_name ?? 'Your Store';
  const memberSince = account?.member_since
    ? new Date(account.member_since).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : '—';

  const tierInfo = TIER_RATES[tier] ?? TIER_RATES.standard;
  const usagePct = billingExempt
    ? 100
    : Math.min(100, Math.round((balance / Math.max(1, tierInfo.tokens)) * 100));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link href="/admin" className="text-sm text-brand hover:underline font-bold">← Back to Admin</Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-2">Billing & API Tokens</h1>
        <p className="text-muted font-medium mt-1">
          Your Player Index API token balance. New storefront keys include{' '}
          <strong className="text-foreground">50 complimentary tokens</strong> at provision time; identification,
          scanner jobs, and oracle calls consume tokens. Use Refill below to buy packs or a monthly plan on Player
          Index.
        </p>
      </div>

      {/* Current Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-muted uppercase tracking-wider">Token Balance</p>
              <p className="text-5xl font-black text-foreground mt-1">
                {billingExempt ? '∞' : balance.toLocaleString()}
              </p>
              {billingExempt && (
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  Unlimited (billing exempt)
                </p>
              )}
            </div>
            <div className="p-3 bg-brand/10 text-brand rounded-xl">
              <Coins className="w-7 h-7" />
            </div>
          </div>

          {/* Progress Bar */}
          {!billingExempt && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold text-muted mb-1">
                <span>{usagePct}% of reference plan bucket</span>
                <span>Reference: {tierInfo.tokens.toLocaleString()} tokens / mo</span>
              </div>
              <div className="w-full bg-surface-hover rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${usagePct > 25 ? 'bg-brand' : usagePct > 10 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          )}

          {!billingExempt && balance < 100 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm font-bold">
              ⚠️ Low balance — pricing and AI scan features will stop working when tokens hit 0.
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 text-brand mb-1">
            <Star className="w-5 h-5" />
            <span className="text-sm font-black uppercase tracking-wider">{tierInfo.label} Plan</span>
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider">Store</p>
            <p className="font-bold text-foreground">{clientName}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider">Member Since</p>
            <p className="font-bold text-foreground">{memberSince}</p>
          </div>
        </div>
      </div>

      {/* Top-Up Plans */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Top-Up Plans</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(TIER_RATES).map(([key, info]) => (
            <div
              key={key}
              className={`rounded-xl border p-5 flex flex-col gap-3 transition-all ${key === tier ? 'border-brand bg-brand/5 shadow-md' : 'border-border hover:border-brand/40'}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-black text-foreground">{info.label}</span>
                {key === tier && (
                  <span className="text-[10px] font-black uppercase bg-brand text-background px-2 py-0.5 rounded-full">Current</span>
                )}
              </div>
              <p className="text-3xl font-black text-brand">{info.price}<span className="text-sm text-muted font-medium">/mo</span></p>
              <p className="text-sm text-muted font-medium">{info.tokens.toLocaleString()} tokens per month</p>
            </div>
          ))}
        </div>
      </div>

      {/* Refill on Player Index */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">Refill tokens or subscribe</h3>
              <p className="text-muted text-sm font-medium max-w-xl">
                Buy token packs or a monthly subscription on Player Index. Sign in with the same account you used to
                claim your API key.
              </p>
            </div>
          </div>
          <a
            href={PLAYER_INDEX_BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand text-background font-black rounded-lg hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
          >
            Open Player Index billing
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <div className="mt-6 pt-6 border-t border-border flex items-start gap-4">
          <div className="p-3 bg-surface-hover text-muted rounded-xl">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground mb-1">Questions?</p>
            <a
              href="mailto:support@playerindexdata.com?subject=Token%20Top-Up%20Request&body=Store%20Name%3A%20%0APlan%20Requested%3A%20%0AMessage%3A"
              className="text-sm text-brand font-bold hover:underline"
            >
              Email support@playerindexdata.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
