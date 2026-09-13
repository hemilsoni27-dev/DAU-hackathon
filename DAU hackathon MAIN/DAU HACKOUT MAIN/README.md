# GridTrade

GridTrade is an AI-powered, grid-aware P2P renewable energy trading platform and digital coordination layer for local solar energy. It connects rooftop-solar prosumers with nearby energy consumers while the physical grid carries the electricity.

## Architecture

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Recharts + Leaflet.
- **Backend API:** Node.js + Express.js REST API (`/api/v1`). Modular architecture: controllers → domain services → repositories.
- **Durable Storage:** PostgreSQL + Prisma ORM (`prisma/schema.prisma`). Single source of truth.
- **Coordination Layer:** Redis (`ioredis`) for Cache, Queues, Rate Limiting, and Pub/Sub event coordination (with local in-memory fallback).
- **AI Service Boundary:** FastAPI Python service (`apps/ai/main.py`) providing a heuristic forecasting engine (ML-ready API interface) for generation, demand, price, and anomaly evaluation.

## What is Implemented

- Hardened PostgreSQL schema with `User`, `SolarSystem`, `EnergyData`, `Listing`, `Demand`, `Trade`, `Transaction`, `Payment`, `HashRecord`, `GridData`, `AiPrediction`, `AuditLog`.
- Repeatable Prisma seed with Scenarios A (Sunny surplus), B (High demand), C (Grid congestion restriction), and D (Balanced grid).
- Express API with thin controllers, domain services, repository pattern, and standardized error envelopes.
- Centralized RBAC permission model with ownership-aware authorization.
- Redis coordination wrappers for Cache, Queue, RateLimit, and Realtime event publishing.
- FastAPI AI boundary endpoints for generation, demand, price, and anomaly predictions (heuristic formulas with ML-ready API schema).
- Domain unit test suite covering energy calculations, decimal arithmetic, grid decisions, multi-factor matching, SHA-256 hashing, anti-tampering, and RBAC authorization. Note: Test coverage is backend-domain-logic focused.

## Commands

```bash
# Generate Prisma Client & OpenAPI contracts
pnpm run prisma:generate
pnpm --filter @workspace/api-spec run codegen

# Validate types, lint, and run tests
pnpm run typecheck
pnpm run test

# Database operations
pnpm run prisma:migrate
pnpm run db:seed

# Build application packages
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/gridtrade-web run build
```

See:
- `docs/architecture/system-overview.md`
- `docs/architecture/domain-boundaries.md`
- `docs/api/api-conventions.md`
- `docs/security/security-baseline.md`
- `docs/decisions/ADR-005-prisma-as-canonical-data-access.md`
- `prisma/schema.prisma`