-- Migration 003: Add upload_kind discriminator to scan_staging
-- Allows Free Track (single_pair) and Premium Track (matrix) rows to be
-- filtered independently so the ManualIngestionGrid never shows raw batch sheets.
-- DEFAULT 'single_pair' back-fills all existing un-classified rows safely.
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS upload_kind TEXT DEFAULT 'single_pair';
