# ──────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for card-app-prod (Next.js Standalone)
# Produces a minimal, production-ready container for Railway / any Docker host.
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc6-compat for Alpine + native modules
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# libc6-compat is required for Tailwind v4 native binaries (lightningcss)
RUN apk add --no-cache libc6-compat

# Copy lockfile + package.json first for caching, then install ALL deps.
# We use `npm install` instead of `npm ci` because the lockfile is generated
# on Windows and lacks linux-musl optional deps (tailwindcss-oxide, lightningcss).
# npm install resolves the correct platform-specific binaries for Alpine.
COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Bake the git SHA into the image for version tracking (Phase 5 update engine)
ARG GIT_SHA=unknown
ENV NEXT_PUBLIC_GIT_SHA=${GIT_SHA}

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# DB init runs at container startup (see docker-entrypoint.sh), not at build time.
# We run `next build` directly.
RUN npx next build

# ── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy the DB init script (runs at startup to migrate schema)
COPY --from=builder /app/init_db.js ./init_db.js

# Copy the entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Set correct ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check for Railway / orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
