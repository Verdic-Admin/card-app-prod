-- Migration 002: Add rookie, auto, relic, and grading attributes to scan_staging and inventory

ALTER TABLE scan_staging
  ADD COLUMN IF NOT EXISTS is_rookie      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_auto        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_relic       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS grading_company TEXT,
  ADD COLUMN IF NOT EXISTS grade          TEXT;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS is_rookie      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_auto        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_relic       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS grading_company TEXT,
  ADD COLUMN IF NOT EXISTS grade          TEXT;
