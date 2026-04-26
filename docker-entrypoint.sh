#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Docker Entrypoint for card-app-prod
# Runs DB schema init (idempotent) before starting the Next.js server.
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "[entrypoint] Running database schema initialization..."
node init_db.js || echo "[entrypoint] DB init warning (non-fatal) — continuing startup."

# ── Self-registration: tell Oracle where this store lives ────────────────────
# Railway injects RAILWAY_PUBLIC_DOMAIN automatically once a domain is generated.
# We also check NEXTAUTH_URL as a fallback for custom domains.
if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
  STORE_URL="https://$RAILWAY_PUBLIC_DOMAIN"
elif [ -n "$NEXTAUTH_URL" ]; then
  STORE_URL="$NEXTAUTH_URL"
else
  STORE_URL=""
fi

if [ -n "$STORE_URL" ] && [ -n "$PLAYERINDEX_API_KEY" ] && [ -n "$API_BASE_URL" ]; then
  echo "[entrypoint] Registering store with Oracle at $API_BASE_URL..."
  curl -sf -X POST "$API_BASE_URL/api/fleet/register" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $PLAYERINDEX_API_KEY" \
    -d "{\"store_url\": \"$STORE_URL\"}" \
    && echo "[entrypoint] Store registered successfully." \
    || echo "[entrypoint] Store registration failed (non-fatal) — continuing startup."
else
  echo "[entrypoint] Skipping self-registration (STORE_URL, PLAYERINDEX_API_KEY, or API_BASE_URL not set)."
fi

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
