-- Migration: Recreate alpha_projections table for Oracle batch API results
-- Stores the full Oracle response per inventory item for historical tracking
-- The inventory table columns (oracle_projection, oracle_trend_percentage) store the latest values
-- This table preserves the full history of all Oracle evaluations

CREATE TABLE IF NOT EXISTS alpha_projections (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references inventory(id) ON DELETE CASCADE not null,
  storefront_id uuid not null,
  projected_target numeric,
  historical_target numeric,
  trend_percentage numeric,
  source text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique constraint on card_id for upsert operations
ALTER TABLE alpha_projections
  ADD CONSTRAINT alpha_projections_card_id_key UNIQUE (card_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_alpha_projections_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_alpha_projections_updated_at ON alpha_projections;
CREATE TRIGGER update_alpha_projections_updated_at
BEFORE UPDATE ON alpha_projections
FOR EACH ROW
EXECUTE PROCEDURE update_alpha_projections_updated_at_column();

-- Enable RLS
ALTER TABLE alpha_projections ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users only
CREATE POLICY "Admins can view alpha projections"
ON alpha_projections FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert alpha projections"
ON alpha_projections FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update alpha projections"
ON alpha_projections FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete alpha projections"
ON alpha_projections FOR DELETE
USING (auth.role() = 'authenticated');
