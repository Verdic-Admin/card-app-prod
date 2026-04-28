#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Docker Entrypoint for card-app-prod
# Runs DB schema init (idempotent) before starting the Next.js server.
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "[entrypoint] Running database schema initialization..."
node init_db.js 2>&1 || echo "[entrypoint] DB init warning (non-fatal) — continuing startup."

# ── Self-registration: tell Oracle where this store lives ────────────────────
if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
  STORE_URL="https://$RAILWAY_PUBLIC_DOMAIN"
elif [ -n "$NEXTAUTH_URL" ]; then
  STORE_URL="$NEXTAUTH_URL"
else
  STORE_URL=""
fi

if [ -n "$STORE_URL" ] && [ -n "$PLAYERINDEX_API_KEY" ] && [ -n "$API_BASE_URL" ]; then
  echo "[entrypoint] Registering store with Oracle..."
  REGISTER_RESPONSE=$(curl -s --show-error --fail-with-body \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $PLAYERINDEX_API_KEY" \
    -d "{\"store_url\": \"$STORE_URL\"}" \
    "$API_BASE_URL/api/fleet/register" 2>&1) \
    && echo "[entrypoint] Store registered successfully." \
    || echo "[entrypoint] Store registration failed (non-fatal) — continuing startup."
else
  echo "[entrypoint] Skipping self-registration (missing config)."
fi

export PORT=3000
export HOSTNAME="0.0.0.0"
echo "[entrypoint] Starting Next.js server..."
exec node server.js
