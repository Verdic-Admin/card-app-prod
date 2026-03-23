---
description: Supabase Database Migration Policy
---

# Supabase Database Migration Policy

To keep our database schema synced and reproducible across environments, we must follow this workflow anytime a schema change is requested:

1. **Never Make Raw Changes Direct-to-Prod**
   - Do not manually edit columns directly in the Supabase UI without writing down the SQL query first.
   
2. **Create a `.sql` Migration File**
   - For every change, create a sequentially numbered SQL file inside `migrations/` (e.g., ` migrations/02_add_user_profiles.sql`).
   - Use `IF NOT EXISTS` for adding columns and tables to ensure the scripts are idempotent and safe to re-run.

3. **Log the State**
   - Once the `.sql` script is written, copy and paste it into the Supabase SQL Editor.
   - Run the script.
   
4. **Agent Retrieval (Optional, but Recommended)**
   - Periodically, or right after major changes, fetch the complete schema using the query available in `scripts/get_supabase_schema.sql` (to be created) and paste it into the chat so the agent stays 100% updated on current column definitions.
