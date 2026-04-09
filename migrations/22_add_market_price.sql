-- Add market_price column to inventory and scan_staging
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS market_price numeric DEFAULT 0;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS market_price numeric DEFAULT 0;
