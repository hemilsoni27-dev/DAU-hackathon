# ADR-005: PostgreSQL + Prisma as Canonical Data Access Layer

## Status
Accepted

## Context
During initial development, the repository contained a mix of Drizzle ORM artifacts (inherited from Replit scaffold template) and Prisma schema definitions (`prisma/schema.prisma`). Maintaining two competing data-access paradigms led to schema drift, duplicated type definitions, and architectural ambiguity.

## Decision
We establish **PostgreSQL + Prisma ORM** as the single canonical database and data-access layer for GridTrade:

1. **Schema Authority:** `prisma/schema.prisma` is the sole authoritative definition of all business domain entities, relationships, constraints, and indexes.
2. **Data Access Pattern:** Express services access PostgreSQL exclusively via thin repository wrappers consuming `@prisma/client`.
3. **Migrations:** Database schema evolution is strictly managed via Prisma Migrations (`prisma/migrations/`).
4. **Seed Data:** Repeatable test & demo datasets are managed via `prisma/seed.ts`.
5. **Drizzle Deprecation:** All Drizzle-related packages, configuration files, and duplicated schemas (`lib/db/drizzle.config.ts`) are completely removed.

## Consequences
- **Positive:** Single source of truth for database models, deterministic type generation, clean migration history, and eliminate ORM duplication.
- **Positive:** Improved developer productivity with standard Prisma Client API.
- **Negative:** Requires running `pnpm run prisma:generate` whenever `schema.prisma` is updated.
