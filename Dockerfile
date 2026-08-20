# ── Stage 1: install dependencies (builds native modules for linux) ────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: build Next.js ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Overridden at runtime by the Fly volume mount
ENV DB_PATH=/data/nwtracker.db

# App source needed at runtime
COPY --from=deps    /app/node_modules  ./node_modules
COPY --from=builder /app/public        ./public
COPY --from=builder /app/.next         ./.next
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/db            ./db

RUN mkdir -p /data

EXPOSE 3000

# Migrate (idempotent) then start the server
CMD ["sh", "-c", "npx tsx db/migrate.ts && npm start"]
