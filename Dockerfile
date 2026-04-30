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

# The lockfile is generated on Windows and pins win32 native binaries.
# We delete it inside the container so npm resolves linux-musl binaries
# for tailwindcss-oxide and lightningcss from scratch.
COPY package.json package-lock.json ./
RUN rm -f package-lock.json \
    && npm install

COPY . .

# Bake the git SHA into the image for version tracking (Phase 5 update engine)
ARG GIT_SHA=unknown
ENV NEXT_PUBLIC_GIT_SHA=${GIT_SHA}

# Set production environment for the build
ENV NODE_ENV=production

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Run the build
RUN npx next build

# ── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Don't run as root
RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output first
COPY --from=builder /app/.next/standalone ./
# Then copy public and static assets into the standalone directory structure
COPY --from=builder /app/public ./public
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


ENTRYPOINT ["./docker-entrypoint.sh"]
