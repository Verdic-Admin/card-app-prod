#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Docker Entrypoint for card-app-prod
# Runs DB schema init (idempotent) before starting the Next.js server.
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "[entrypoint] Running database schema initialization..."
node init_db.js || echo "[entrypoint] DB init warning (non-fatal) — continuing startup."

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
