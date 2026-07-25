# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /app

# Install build tools for better-sqlite3 native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---- Build stage ----
FROM base AS build
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app

# libstdc++ needed for better-sqlite3 prebuilt binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built app + boot script + seed DB
COPY --from=build /app/dist ./dist
COPY --from=build /app/seed-db.sqlite ./seed-db.sqlite
COPY --from=build /app/scripts ./scripts

# Fly volumes mount at /data — DB will live there
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/data-v2.db
ENV SEED_DB_PATH=/app/seed-db.sqlite

EXPOSE 8080

# render-boot.cjs handles: create /data if missing, copy seed on first boot, seed admin, then exec start command
CMD ["node", "scripts/render-boot.cjs"]
