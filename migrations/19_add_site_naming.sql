-- Migration 19: Add site branding columns to store_settings

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS site_name text NOT NULL DEFAULT 'My Card Store';

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS site_author text;
