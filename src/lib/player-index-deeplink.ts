/**
 * Builds a Player Index Card Forecaster URL with query params so the app
 * can hydrate player + card fields and (when player + set are present) run
 * the on-load forecast. Matches player-index-oracle `page.tsx` / CardForecasterClient.
 *
 * @see https://playerindexdata.com/?player=...&set=...
 */

/** Strip leading # so Player Index `number` query matches catalog (e.g. #330 → 330). */
export function normalizeCardNumberForPlayerIndex(cardNumber: string | null | undefined): string {
  return String(cardNumber ?? '')
    .trim()
    .replace(/^#+\s*/, '')
    .trim();
}

export type PlayerIndexDeeplinkItem = {
  player_name?: string | null;
  card_set?: string | null;
  card_number?: string | null;
  insert_name?: string | null;
  parallel_name?: string | null;
  parallel_insert_type?: string | null;
  print_run?: string | number | null;
  is_auto?: boolean | null;
  is_relic?: boolean | null;
  is_rookie?: boolean | null;
  grading_company?: string | null;
  grade?: string | null;
};

function truthyFlag(v: unknown): boolean {
  return v === true || v === 't' || v === 'true' || v === 1;
}

export function getPlayerIndexAppOrigin(): string {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PLAYER_INDEX_APP_URL) ||
    'https://playerindexdata.com';
  return String(raw).replace(/\/+$/, '') || 'https://playerindexdata.com';
}

/**
 * Converts a player name to a clean URL slug (matches the Player Index directory logic).
 */
export function slugifyPlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Full forecaster deep link with card context. Always includes `player` when known.
 * Include `set` whenever you have it so SSR + client auto-run the card calculation.
 */
export function buildPlayerIndexForecasterUrl(
  item: PlayerIndexDeeplinkItem,
  opts?: { refShop?: string },
): string {
  const origin = getPlayerIndexAppOrigin();
  const player = String(item.player_name ?? '').trim();
  if (!player) return `${origin}/`;

  const slug = slugifyPlayerName(player);
  const u = new URL(`/player/${slug}`, origin);

  const set = String(item.card_set ?? '').trim();
  if (set) u.searchParams.set('set', set);

  const ins = String(item.insert_name ?? '').trim();
  if (ins && ins.toLowerCase() !== 'base') {
    u.searchParams.set('insert', ins);
  }

  let parallel = String(item.parallel_name ?? '').trim();
  const pit = String(item.parallel_insert_type ?? '').trim();
  if ((!parallel || parallel.toLowerCase() === 'base') && pit && pit.toLowerCase() !== 'base') {
    parallel = pit;
  }
  if (parallel && parallel.toLowerCase() !== 'base') {
    u.searchParams.set('parallel', parallel);
  }

  const cardNum = normalizeCardNumberForPlayerIndex(item.card_number);
  if (cardNum) {
    u.searchParams.set('number', cardNum);
  }

  const pr = item.print_run;
  if (pr != null && String(pr).trim() !== '') {
    u.searchParams.set('printRun', String(pr).trim());
  }

  if (truthyFlag(item.is_auto)) u.searchParams.set('isAuto', 'true');
  if (truthyFlag(item.is_relic)) u.searchParams.set('isRelic', 'true');
  if (truthyFlag(item.is_rookie)) u.searchParams.set('isRookie', 'true');

  const gc = String(item.grading_company ?? '').trim();
  const gr = String(item.grade ?? '').trim();
  if (gc && gr) {
    u.searchParams.set('grade', `${gc} ${gr}`.trim());
  }

  const ref = opts?.refShop ?? process.env.NEXT_PUBLIC_SHOP_ID;
  if (ref) {
    u.searchParams.set('ref_name', ref);
  }

  return u.toString();
}
