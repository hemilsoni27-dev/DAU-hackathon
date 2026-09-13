# GridTrade — Rollback Strategy

## Guiding Principle

Any deployment can be rolled back within 5 minutes by reverting the container image and, if needed, the database migration. Rollback should be practiced before incidents, not invented during them.

---

## Code Rollback

### Docker Compose (production)

```bash
# 1. Identify the last good image tag from CI
#    Example: gridtrade-api:abc1234

# 2. Update docker-compose.production.yml image tags
#    Change:  image: gridtrade-api:new-broken-tag
#    To:      image: gridtrade-api:abc1234

# 3. Redeploy
docker compose -f docker-compose.production.yml up -d --no-deps api

# 4. Verify readiness
curl http://localhost:5000/api/ready
```

### Git Revert (source of truth)

```bash
# Identify bad commit
git log --oneline -10

# Option A: Revert (safe, creates new commit — preferred for main)
git revert <bad-commit-sha> --no-edit
git push origin main

# Option B: Hard reset (only for non-shared branches)
git reset --hard <last-good-sha>
git push --force-with-lease origin main
```

---

## Database Migration Rollback

> **Warning**: Prisma does not have automatic rollback. All schema changes must be designed to be backwards-compatible for safe zero-downtime deployments.

### Step-by-step

```bash
# 1. Check current migration state
pnpm prisma migrate status

# 2. Write a manual SQL undo script for the failed migration
#    Example: undo adding a required column
#    ALTER TABLE "Trade" DROP COLUMN IF EXISTS "newField";

# 3. Apply the manual rollback
psql "$DATABASE_URL" -f rollback-YYYYMMDD.sql

# 4. Mark migration as rolled back in _prisma_migrations table
psql "$DATABASE_URL" -c "
  UPDATE _prisma_migrations
  SET rolled_back_at = NOW()
  WHERE migration_name = '20260912000000_my_migration'
"

# 5. Remove the migration file
rm prisma/migrations/20260912000000_my_migration/migration.sql
```

### Safe Migration Rules

Always design migrations that are:

1. **Additive**: New columns should be nullable or have defaults
2. **Backwards-compatible**: Old code should still work with new schema
3. **Two-phase**: For column renames — add new, backfill, remove old in separate deploys

---

## Incident Response

| Severity | Response Time | Rollback Trigger |
|---|---|---|
| P0 — complete outage | < 5 min | Automatic — roll back immediately |
| P1 — partial degradation | < 15 min | If degradation > 10% error rate |
| P2 — single feature broken | < 1 hour | If no hotfix available in 30 min |
| P3 — cosmetic / non-critical | Next sprint | Scheduled fix |

### Health Check Commands

```bash
# Liveness
curl http://localhost:5000/api/healthz

# Readiness (deps required)
curl http://localhost:5000/api/ready

# Expected healthy response:
# { "status": "ready", "dependencies": { "postgres": "ok", "redis": "ok" } }
```

---

## Rollback Decision Matrix

| Condition | Action |
|---|---|
| `GET /ready` → 503 after deploy | Immediate rollback |
| Test suite failures in CI | Block deploy, fix forward |
| Error rate > 5% on `/v1/trades` | P0 rollback |
| Payment webhook fails | Check idempotency key, don't rollback — fix forward |
| Ledger hash verification fails | P0 — data integrity alert |

---

## Post-Incident

After any rollback:

1. Write a post-mortem (timeline, root cause, impact, fix, prevention)
2. Add a regression test covering the failure case
3. Verify rollback procedure worked as documented; update if not
4. Merge hotfix to both `main` and `develop` branches
