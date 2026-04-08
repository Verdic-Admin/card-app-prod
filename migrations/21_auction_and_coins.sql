-- Migration 21: Add CRM Coin Requests and Auction Staging

CREATE TABLE IF NOT EXISTS public.coin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.inventory(id) ON DELETE CASCADE,
  buyer_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS coined_image_url text,
  ADD COLUMN IF NOT EXISTS auction_reserve_price numeric,
  ADD COLUMN IF NOT EXISTS auction_end_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS auction_description text;
