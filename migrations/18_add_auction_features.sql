-- Part 1: Database Migration (migrations/18_add_auction_features.sql)
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS live_stream_url TEXT;

ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS is_auction BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auction_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_code TEXT,
  ADD COLUMN IF NOT EXISTS is_verified_flip BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS current_bid NUMERIC;
