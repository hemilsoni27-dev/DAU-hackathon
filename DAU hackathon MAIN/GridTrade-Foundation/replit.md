# GridTrade

GridTrade is a grid-aware coordination layer for local renewable-energy trading. It helps prosumers and consumers discover, price, and record energy exchanges without physically routing electricity outside the existing grid.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/gridtrade-web run dev` — run the web app
- `pnpm run typecheck` — full TypeScript check
- `pnpm run build` — typecheck and build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push the Drizzle schema to development PostgreSQL
- `docker compose up -d postgres redis` — start local infrastructure

Required environment:

- `DATABASE_URL` — PostgreSQL connection string
- `PORT`, `BASE_PATH` — injected by the managed workflows
- `REDIS_URL` — optional during development; enables the Redis coordinator when present

## Stack

- pnpm workspace, Node.js 24, TypeScript 5.9
- Web: React, Vite, Tailwind CSS, Recharts, Wouter, React Query
- API: Express 5, TypeScript, REST, Zod, pino
- Database: PostgreSQL, Drizzle runtime schema, portable Prisma contract in `prisma/schema.prisma`
- Coordination: Redis-compatible RESP coordinator with no hard dependency when Redis is unavailable
- AI boundary: FastAPI under `apps/ai`

## Where things live

- `artifacts/gridtrade-web` — user-facing control-room web app
- `artifacts/api-server` — modular-monolith REST API
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/api-client-react` and `lib/api-zod` — generated API clients and validation
- `lib/db/src/schema` — development PostgreSQL schema and indexes
- `prisma/schema.prisma` — portable Prisma model contract
- `apps/ai` — FastAPI boundary for future models
- `docs` — architecture, API, security, and decision records

## Architecture decisions

- PostgreSQL is the source of truth; Redis is optional coordination infrastructure, never durable state.
- The API stays a modular monolith until domain boundaries have real scaling pressure.
- The current workspace already supplied Drizzle, so the runtime schema uses it without replacing working infrastructure; Prisma remains aligned as a portable schema/migration boundary.
- Clerk is the intended production authentication boundary. Until a managed tenant is configured, development uses an explicit demo session context rather than local password/JWT authentication.
- Domain rules for surplus, grid decisions, matching, and ownership live outside controllers.

## Product

The first foundation surface includes a live operating picture, marketplace browsing and publishing, solar-system registration, grid status, match recommendations, persisted activity views, request IDs, structured logging, validation, RBAC policy seams, and an AI-service boundary. Full forecasting, utility integrations, smart meters, payments, and settlement workflows remain future phases.

## Gotchas

- Run API codegen after every OpenAPI change.
- Run `pnpm --filter @workspace/db run push` after changing the Drizzle schema.
- Do not use floating-point values for money or energy rules; domain helpers use scaled integer arithmetic where calculations matter.
- The API health endpoint returns degraded status when PostgreSQL is unreachable.