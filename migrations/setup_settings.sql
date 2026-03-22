-- Run this in your Supabase SQL Editor!

CREATE TABLE IF NOT EXISTS public.store_settings (
    id integer PRIMARY KEY DEFAULT 1,
    cart_minimum numeric NOT NULL DEFAULT 20.00,
    site_announcement text NOT NULL DEFAULT '',
    paypal_email text NOT NULL DEFAULT '',
    allow_offers boolean NOT NULL DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);

-- Ensure there is always exactly one row (ID 1)
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the settings (so the cart and header can see them)
CREATE POLICY "Public can view store settings" 
ON public.store_settings FOR SELECT 
USING (true);

-- Allow only authenticated users (admins) to update the settings
CREATE POLICY "Admins can update store settings" 
ON public.store_settings FOR UPDATE 
USING (auth.role() = 'authenticated');
