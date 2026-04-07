-- Migration: Add oracle_trend_percentage column to inventory
-- Stores the trend_percentage returned by the centralized Oracle API.

ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS oracle_trend_percentage numeric;
