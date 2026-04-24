-- Enable the pg_trgm extension if it doesn't already exist.
-- This extension provides functions and operators for determining the similarity of text based on trigram matching,
-- which makes ILIKE and fuzzy searches extremely fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for fast ILIKE and partial text matching on heavily queried columns.
-- Using 'IF NOT EXISTS' to ensure the migration is safely re-runnable.

-- 1. master_card_catalog (approx 955k rows)
CREATE INDEX IF NOT EXISTS master_card_catalog_player_name_trgm_idx 
    ON master_card_catalog USING GIN (player_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS master_card_catalog_card_set_trgm_idx 
    ON master_card_catalog USING GIN (card_set gin_trgm_ops);

CREATE INDEX IF NOT EXISTS master_card_catalog_card_number_trgm_idx 
    ON master_card_catalog USING GIN (card_number gin_trgm_ops);

-- 2. set_parallel_catalog (approx 548k rows)
CREATE INDEX IF NOT EXISTS set_parallel_catalog_set_name_trgm_idx 
    ON set_parallel_catalog USING GIN (set_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS set_parallel_catalog_parallel_name_trgm_idx 
    ON set_parallel_catalog USING GIN (parallel_name gin_trgm_ops);
