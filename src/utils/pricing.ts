import { price } from '@/utils/math';

type DeriveDisplayPricingInput = {
  listed_price?: unknown;
  avg_price?: unknown;
  oracle_projection?: unknown;
  oracle_discount_percentage?: unknown;
};

export type DerivedDisplayPricing = {
  playerIndexPrice: number;
  discountPercent: number;
  computedDiscountPrice: number;
  effectiveStorePrice: number;
  hasProjection: boolean;
  hasManualOverride: boolean;
  percentBelowPlayerIndex: number;
  savingsAmount: number;
};

/**
 * Canonical display pricing model used by storefront + admin UI.
 *
 * Hybrid behavior:
 * - If projection exists, compute discounted price from projection + configured discount.
 * - If listed price diverges from computed price, treat as manual override and show listed.
 * - If no projection exists, fall back to listed/avg.
 */
export function deriveDisplayPricing(input: DeriveDisplayPricingInput): DerivedDisplayPricing {
  const listed = price(input.listed_price, 0);
  const avg = price(input.avg_price, 0);
  const projection = price(input.oracle_projection, 0);
  const discountPercent = Math.max(0, price(input.oracle_discount_percentage, 0));
  const hasProjection = projection > 0;

  const fallbackStorePrice = listed > 0 ? listed : avg;
  
  // Discount is now applied directly to the listed/avg price, NOT the player index
  const computedDiscountPrice = Math.max(0, fallbackStorePrice * (1 - discountPercent / 100));

  // The effective price is just the discounted base price.
  const effectiveStorePrice = computedDiscountPrice;

  // We no longer heuristically detect manual overrides this way since the discount 
  // is applied directly to the user's listed price anyway.
  const hasManualOverride = listed > 0 && Math.abs(listed - avg) > 0.01;

  // Savings amount is now how much they save vs the original price, OR vs the projection
  // if you still want to show "percent below player index". We'll compare against projection
  // to maintain the "Player Index Savings" UI.
  const savingsAmount = hasProjection
    ? Math.max(0, projection - effectiveStorePrice)
    : 0;

  const percentBelowPlayerIndex =
    hasProjection && projection > 0
      ? Math.max(0, (savingsAmount / projection) * 100)
      : 0;

  return {
    playerIndexPrice: projection,
    discountPercent,
    computedDiscountPrice,
    effectiveStorePrice,
    hasProjection,
    hasManualOverride,
    percentBelowPlayerIndex,
    savingsAmount,
  };
}
