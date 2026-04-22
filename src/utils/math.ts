/**
 * Coerce a pg NUMERIC column (returned as string) or any unknown value to a
 * finite JS number so .toFixed() and arithmetic work safely everywhere.
 *
 *   price(row.listed_price ?? row.avg_price)          → number
 *   price(row.listed_price ?? row.avg_price, 9.99)    → fallback when null/NaN
 */
export function price(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Calculates the exact median of an array of numbers.
 * Sorts numerically. If the array has an even length, it returns the average of the two middle elements.
 * Critical to prevent massive outliers (e.g., 1/1 superficial cards) from destroying the baseline PBI.
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  
  // Clone array to avoid mutating the original, then sort ascending
  const sorted = [...values].sort((a, b) => a - b);
  const midPoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Even length array: average the two middle numbers
    return (sorted[midPoint - 1] + sorted[midPoint]) / 2.0;
  } else {
    // Odd length array: exactly return the middle number
    return sorted[midPoint];
  }
}
