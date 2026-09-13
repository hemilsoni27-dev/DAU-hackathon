---
name: GridTrade foundation decisions
description: Durable architecture decisions for the GridTrade foundation.
---

GridTrade keeps the workspace's existing Drizzle runtime database package and
maintains an aligned Prisma schema as the portable model/migration boundary.

**Why:** The scaffold already had a working Drizzle package and generated
database workflow; replacing it during the foundation phase would add risk
without improving the first product surface.

**How to apply:** Keep PostgreSQL as the durable source of truth and update
both the Drizzle schema and Prisma contract when adding domain entities.

Production identity is intended to use Clerk. Until the managed tenant is
configured, the API uses an explicit, clearly marked demo session context
instead of introducing local password hashing or JWT auth.

**Why:** Replit's auth guidance prefers managed Clerk and prohibits inventing
local auth when the provider is not configured.

**How to apply:** Replace the demo context with Clerk verification and user
role mapping before exposing the app to real users; keep RBAC policies and
domain ownership checks server-side.