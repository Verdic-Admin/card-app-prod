-- 1. Create Initial Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id uuid default gen_random_uuid() primary key,
  filename text,
  player_name text,
  card_set text,
  parallel_insert_type text,
  high_price numeric,
  low_price numeric,
  avg_price numeric,
  image_url text,
  status text check (status in ('available', 'sold'))
);

-- Enable Row Level Security (RLS)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Allow public read access (since it's a storefront)
CREATE POLICY "Allow public read access to inventory"
  ON inventory FOR SELECT
  USING (true);

-- 2. Modify Inventory Columns
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS card_number TEXT;

-- 3. Create Trade Offers Table
create table IF NOT EXISTS trade_offers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  buyer_name text not null,
  buyer_email text not null,
  offer_text text not null,
  target_items jsonb not null,
  status text default 'pending'::text
);

-- 4. Add Financial Columns to Inventory
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS listed_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_basis numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS accepts_offers boolean DEFAULT false;

-- 5. Add Sold Timestamp
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sold_at timestamp with time zone;

-- 6. Add Back Image URL
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS back_image_url text;

-- 7. Ensure Settings Table Setup
-- (Assuming store_settings was created previously based on setup_settings.sql)
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Drop exist policies just in case to recreate safely
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings" 
ON public.store_settings FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
CREATE POLICY "Admins can update store settings" 
ON public.store_settings FOR UPDATE 
USING (auth.role() = 'authenticated');

-- 8. Re-Add Team Name
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS team_name text;

-- 9. Add Store Description & Early Socials
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS store_description text NOT NULL DEFAULT 'Zero-Fee Sports Card Storefront. Prices reflect direct-to-buyer savings. No hidden buyer premiums, just high-quality cards shipped directly to you.',
ADD COLUMN IF NOT EXISTS social_instagram text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS social_twitter text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS social_facebook text NOT NULL DEFAULT '';

-- 10. Add Attached Image to Trade Offers
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS attached_image_url text;

-- 11. Add Discord to Socials
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_discord text;
