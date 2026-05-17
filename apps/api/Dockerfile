# ─────────────────────────────────────────────────────────────
# DOM BIM Platform — API & Worker image
# Build context: monorepo root  (docker-compose sets context: ../..)
# ─────────────────────────────────────────────────────────────

# ── Stage 1: builder ─────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# 1. Copy every workspace package.json (npm ci validates the full lockfile)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/z-schema-patched/ packages/z-schema-patched/

# 2. Prisma schema (required by prisma generate)
COPY packages/database/prisma/ packages/database/prisma/

# 3. Install ALL deps with lifecycle scripts blocked (supply-chain attack mitigation).
#    Only the two Prisma scripts required for `prisma generate` are re-run explicitly.
#    All other lifecycle scripts (puppeteer Chrome download, scarf telemetry, etc.) are skipped.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV SCARF_ANALYTICS=false
RUN npm ci --ignore-scripts
# Re-run ONLY the Prisma install scripts needed to download the query-engine binary.
RUN node node_modules/prisma/scripts/preinstall-entry.js && \
    node node_modules/@prisma/engines/scripts/postinstall.js

# 4. Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# 5. Copy API source and compile
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src/ apps/api/src/
RUN npm run build --workspace=apps/api


# ── Stage 2: production ──────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# OpenSSL 3.x — required by Prisma query engine at runtime
RUN apk add --no-cache openssl

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser  -u 1001 -S nodejs -G nodejs

# Suppress lifecycle scripts and telemetry in the production install
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV SCARF_ANALYTICS=false

# 1. Re-install production-only dependencies (lifecycle scripts already blocked)
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs apps/api/package.json apps/api/
COPY --chown=nodejs:nodejs apps/web/package.json apps/web/
COPY --chown=nodejs:nodejs packages/database/package.json packages/database/
COPY --chown=nodejs:nodejs packages/z-schema-patched/ packages/z-schema-patched/
RUN npm ci --omit=dev --ignore-scripts

# 2. Generated Prisma client (prisma CLI is a devDep, so we copy the output)
COPY --chown=nodejs:nodejs --from=builder /app/node_modules/.prisma/ node_modules/.prisma/

# 3. Prisma schema (needed at runtime for connection string resolution)
COPY --chown=nodejs:nodejs packages/database/prisma/ packages/database/prisma/

# 4. Compiled TypeScript
COPY --chown=nodejs:nodejs --from=builder /app/apps/api/dist/ apps/api/dist/

# 5. Runtime directories (only these need nodejs ownership — not all of /app)
RUN mkdir -p apps/api/uploads apps/api/downloads apps/api/logs && \
    chown nodejs:nodejs apps/api/uploads apps/api/downloads apps/api/logs

USER nodejs
WORKDIR /app/apps/api

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD ["wget","--no-verbose","--tries=1","--spider","http://localhost:8080/health"]

CMD ["node", "dist/src/index.js"]
