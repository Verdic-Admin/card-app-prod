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
