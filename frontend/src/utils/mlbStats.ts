/**
 * MLB Stats API Integration & Fundamental Alpha ($\alpha_f$) Utility
 */

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

export type MlbPlayerStats = {
  isPitcher: boolean;
  statType: 'OPS' | 'WHIP';
  statValue: number;
  plateAppearances?: number;
  inningsPitched?: number;
};

/**
 * Resolves a normalized player name to their MLB Stats API Player ID.
 */
export async function resolvePlayerId(playerName: string): Promise<number | null> {
  try {
    // Sport ID 1 = Major League Baseball
    const url = `${MLB_API_BASE}/people/search?names=${encodeURIComponent(playerName)}&sportIds=1`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.people && data.people.length > 0) {
      // For V1, we take the top exact match or highest ranked result.
      return data.people[0].id;
    }
    return null;
  } catch (error) {
    console.warn(`Failed to resolve MLB ID for ${playerName}:`, error);
    return null;
  }
}

/**
 * Fetches the current season hitting or pitching stats for an MLB Player.
 */
export async function fetchPlayerStats(playerId: number): Promise<MlbPlayerStats | null> {
  try {
    const url = `${MLB_API_BASE}/people/${playerId}/stats?stats=season&group=hitting,pitching`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.stats || data.stats.length === 0) return null;

    let hittingGroup = data.stats.find((g: any) => g.group.displayName === 'hitting');
    let pitchingGroup = data.stats.find((g: any) => g.group.displayName === 'pitching');

    const hittingStats = hittingGroup?.splits?.[0]?.stat;
    const pitchingStats = pitchingGroup?.splits?.[0]?.stat;

    // Determine if player is primarily a pitcher or hitter for the season based on volume
    const plateAppearances = hittingStats?.plateAppearances ? parseInt(hittingStats.plateAppearances) : 0;
    const inningsPitchedStr = pitchingStats?.inningsPitched || "0";
    const inningsPitched = parseFloat(inningsPitchedStr);

    if (inningsPitched > 0 && inningsPitched > (plateAppearances / 3)) {
      // Likely a pitcher (or Ohtani pitching mode, but we classify based on volume for V1)
      const whip = parseFloat(pitchingStats?.whip || "0");
      return {
        isPitcher: true,
        statType: 'WHIP',
        statValue: whip,
        inningsPitched: inningsPitched
      };
    } else if (plateAppearances > 0) {
      // Hitter
      const ops = parseFloat(hittingStats?.ops || "0");
      return {
        isPitcher: false,
        statType: 'OPS',
        statValue: ops,
        plateAppearances: plateAppearances
      };
    }

    return null;
  } catch (error) {
    console.warn(`Failed to fetch stats for Player ID ${playerId}:`, error);
    return null;
  }
}

/**
 * Calculates the Fundamental Alpha ($\alpha_f$) momentum score.
 * Enforces Volatility Guardrails (minimum sample sizes).
 * Accepts an optional historical baseline, defaulting to league averages.
 */
export function calculateFundamentalAlpha(
  stats: MlbPlayerStats,
  playerHistoricalBaseline?: number
): number {
  // 1. Volatility Guardrail (Small Sample Size filter)
  const MIN_PA = 20;
  const MIN_IP = 10;

  if (!stats.isPitcher && (!stats.plateAppearances || stats.plateAppearances < MIN_PA)) {
    return 0.00; // Neutral/Hold
  }
  if (stats.isPitcher && (!stats.inningsPitched || stats.inningsPitched < MIN_IP)) {
    return 0.00; // Neutral/Hold
  }

  // 2. Establish Baseline (Relative vs Absolute)
  // For V1 proof of concept, default to static league averages if no historical trace is provided.
  let baseline = playerHistoricalBaseline;
  if (baseline === undefined) {
    baseline = stats.isPitcher ? 1.30 : 0.720; // Default WHIP = 1.30, Default OPS = .720
  }

  // Prevent divide by zero edge cases
  if (baseline === 0) return 0.00;

  // 3. Momentum Math
  if (!stats.isPitcher) {
    // Hitters (OPS): Higher is better.
    // e.g., (0.900 - 0.720) / 0.720 = +25% momentum
    return (stats.statValue - baseline) / baseline;
  } else {
    // Pitchers (WHIP): Lower is better.
    // e.g., (1.30 - 1.00) / 1.30 = +23% momentum
    return (baseline - stats.statValue) / baseline;
  }
}
