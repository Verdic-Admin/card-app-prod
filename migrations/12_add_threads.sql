-- Quick fix for social_threads missing from the database
-- Run this in your Supabase SQL Editor to unblock the admin dashboard saves!

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS social_threads text;
