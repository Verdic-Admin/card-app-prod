-- Migration 20: Add site theme column to store_settings

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS site_theme text NOT NULL DEFAULT 'dark';
