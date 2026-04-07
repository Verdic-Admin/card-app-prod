-- Migration: Drop alpha_projections table
-- This table is no longer used by the Next.js storefront.
-- All Oracle math is now handled by the centralized Python backend.

DROP TABLE IF EXISTS public.alpha_projections CASCADE;
