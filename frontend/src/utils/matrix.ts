/**
 * Hub & Spoke Matrix
 * Dictionaries and math functions to scale overarching Player Base Index (PBI) 
 * valuations down to individual asset derivatives within the Shadow Book.
 */

// V1 Hardcoded Core Dictionaries
const SET_COEFFICIENTS: Record<string, number> = {
  'Topps Chrome Update': 1.0,
  'Topps Update Series': 0.8,
  'Topps Holiday': 0.6,
  'Bowman Chrome': 1.2,
  'Topps Chrome': 1.1,
  'Topps Series 1': 0.9,
  'Topps Series 2': 0.9,
};

const PARALLEL_MULTIPLIERS: Record<string, number> = {
  'Base': 1.0,
  'Refractor': 1.5,
  'RayWave Refractor': 2.0,
  'X-Fractor': 2.5,
  'Gold Lights': 3.0,
  'Stars of MLB': 0.5,
  'Chrome': 1.0,
  'Prism Refractor': 2.0
};

export type AfvCalculation = {
  afv: number;
  c_set: number;
  m_parallel: number;
  is_hub: boolean;
}

/**
 * Calculates the Algorithmic Fair Value (AFV) of a specific asset derivative
 * based on the target Player Base Index (PBI).
 */
export function calculateAFV(
  targetPbi: number,
  cardSet: string | null | undefined,
  parallelType: string | null | undefined
): AfvCalculation {
  // Normalize string logic safely
  const formatKey = (key?: string | null) => key ? key.trim() : 'Unknown';
  
  const formattedSet = formatKey(cardSet);
  const formattedParallel = formatKey(parallelType);

  let cSet = SET_COEFFICIENTS[formattedSet];
  if (cSet === undefined) {
    console.warn(`[Matrix Warn] Unknown Set found: "${formattedSet}". Defaulting C_set coefficient to 1.0.`);
    cSet = 1.0;
  }

  let mParallel = PARALLEL_MULTIPLIERS[formattedParallel];
  if (mParallel === undefined) {
    console.warn(`[Matrix Warn] Unknown Parallel found: "${formattedParallel}". Defaulting M_parallel multiplier to 1.0.`);
    mParallel = 1.0;
  }

  // Anchor Assets (Hub) are defined as our core liquidity baseline multipliers
  const is_hub = Math.abs(mParallel - 1.0) < 0.01;

  // Final Matrix Math
  const afv = targetPbi * cSet * mParallel;

  return {
    afv,
    c_set: cSet,
    m_parallel: mParallel,
    is_hub
  };
}
