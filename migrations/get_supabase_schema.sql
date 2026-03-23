-- Run this query in your Supabase SQL Editor and copy/paste the results to the AI whenever the database schema changes significantly.
-- This allows the AI to stay perfectly synced with your live database schema.

SELECT 
    table_name, 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name, 
    ordinal_position;
