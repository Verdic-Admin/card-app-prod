-- Migration: Add sport column to inventory and staging
-- Defaults to 'mlb' to maintain backward compatibility for existing cards.

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'mlb';
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'mlb';

-- Index for performance in lookups
CREATE INDEX IF NOT EXISTS idx_inventory_sport ON inventory(sport);
CREATE INDEX IF NOT EXISTS idx_scan_staging_sport ON scan_staging(sport);
