-- Optional manual migration (one-off). New deployments: `init_db.js` on start applies the same changes.
-- Paired front/back land in raw_* first; cropped singles use image_url / back_image_url.

ALTER TABLE scan_staging
  ADD COLUMN IF NOT EXISTS raw_front_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_back_url TEXT;

-- Allow uncropped rows to exist with only raw URLs (nullable cropped columns).
ALTER TABLE scan_staging
  ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE scan_staging
  ALTER COLUMN back_image_url DROP NOT NULL;
