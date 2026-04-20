/** Player Index web app — token packs & subscriptions (override for staging). */
export const PLAYER_INDEX_BILLING_URL =
  (process.env.NEXT_PUBLIC_PLAYER_INDEX_BILLING_URL || '').replace(/\/$/, '') ||
  'https://playerindexdata.com/developers/dashboard/billing';
