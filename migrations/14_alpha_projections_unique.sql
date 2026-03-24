-- Fix for missing UNIQUE constraint on card_id in alpha_projections table
-- This is required for Supabase UPSERT operations with { onConflict: 'card_id' } to work.

ALTER TABLE IF EXISTS alpha_projections 
  ADD CONSTRAINT alpha_projections_card_id_key UNIQUE (card_id);
