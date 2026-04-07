# Supabase Connection Reference

## Project Details
- **Project Ref:** `rdlqsxraxieoxzkhfxub`
- **API URL:** `https://rdlqsxraxieoxzkhfxub.supabase.co`
- **Dashboard:** https://supabase.com/dashboard/project/rdlqsxraxieoxzkhfxub

## Agent MCP Connection
The Antigravity MCP config is located at:
```
c:\Users\quija\.gemini\antigravity\mcp_config.json
```
It contains:
```json
"supabase": {
  "serverUrl": "https://mcp.supabase.com/mcp?project_ref=rdlqsxraxieoxzkhfxub"
}
```

## Frontend Environment Variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://rdlqsxraxieoxzkhfxub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key in .env.local>
SUPABASE_SERVICE_ROLE_KEY=<service role key in .env.local>
```

## Current Schema (public)
| Table | RLS | Description |
|---|---|---|
| `inventory` | ✅ | Card inventory with Oracle pricing fields |
| `store_settings` | ✅ | Global storefront configuration (1 row) |
| `trade_offers` | ✅ | Buyer trade/offer submissions |

## Key Columns on `inventory` (Oracle-related)
- `oracle_projection` — The raw projected target from the Oracle API
- `oracle_trend_percentage` — Trend percentage from the Oracle API
- `listed_price` — Final consumer price (projection × discount)

## Publishable Keys
- **Legacy Anon Key:** Stored in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Modern Publishable Key:** `sb_publishable_7SlGtQr1Gig8Z8znGP8q-w_YOP0PcE6`
