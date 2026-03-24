-- 1. Create Alpha Projections Table
CREATE TABLE IF NOT EXISTS alpha_projections (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references inventory(id) ON DELETE CASCADE not null,
  is_hub boolean default false not null,
  pbi_target numeric,
  c_set numeric,
  m_parallel numeric,
  alpha_f numeric,
  alpha_s numeric,
  afv numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create updated_at trigger function if it doesn't already exist
CREATE OR REPLACE FUNCTION update_alpha_projections_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Attach trigger to table
DROP TRIGGER IF EXISTS update_alpha_projections_updated_at ON alpha_projections;
CREATE TRIGGER update_alpha_projections_updated_at
BEFORE UPDATE ON alpha_projections
FOR EACH ROW
EXECUTE PROCEDURE update_alpha_projections_updated_at_column();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE alpha_projections ENABLE ROW LEVEL SECURITY;

-- 5. Restrict access to Admins only
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
