# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy library packages that api-server depends on
COPY lib/ ./lib/

# Copy api-server source
COPY artifacts/api-server/ ./artifacts/api-server/

# Copy prisma schema (needed by @prisma/client generation)
COPY prisma/ ./prisma/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @workspace/api-server run prisma:generate || npx prisma generate

# Build api-server
RUN pnpm --filter @workspace/api-server run build

# ─── Runtime Stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN addgroup -S gridtrade && adduser -S gridtrade -G gridtrade

WORKDIR /app

# Copy built output from builder
COPY --from=builder /workspace/artifacts/api-server/dist/ ./dist/
COPY --from=builder /workspace/artifacts/api-server/package.json ./package.json

# Copy prisma for runtime migration capability
COPY --from=builder /workspace/prisma/ ./prisma/
COPY --from=builder /workspace/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/ /app/node_modules/@prisma/client/ 2>/dev/null || true

# Only production node_modules
COPY --from=builder /workspace/node_modules/ ./node_modules/

USER gridtrade

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/healthz || exit 1

CMD ["node", "dist/index.mjs"]
