# GridTrade — Backup and Restore

## PostgreSQL

### Backup

```bash
# Full database dump (recommended format: custom)
pg_dump \
  --format=custom \
  --compress=9 \
  --verbose \
  "$DATABASE_URL" \
  -f "gridtrade-$(date +%Y%m%d-%H%M%S).pgdump"

# Plain SQL dump (for inspection)
pg_dump \
  --format=plain \
  "$DATABASE_URL" \
  -f "gridtrade-$(date +%Y%m%d-%H%M%S).sql"
```

### Restore

```bash
# Restore from custom format backup
pg_restore \
  --clean \
  --if-exists \
  --verbose \
  -d "$DATABASE_URL" \
  gridtrade-<timestamp>.pgdump

# Restore from plain SQL dump
psql "$DATABASE_URL" < gridtrade-<timestamp>.sql
```

### Automated Daily Backup (Docker)

Add to `docker-compose.production.yml`:

```yaml
pg-backup:
  image: postgres:16-alpine
  environment:
    PGPASSWORD: ${POSTGRES_PASSWORD}
  volumes:
    - ./backups:/backups
  networks:
    - gridtrade-internal
  entrypoint: |
    sh -c 'pg_dump \
      -h postgres \
      -U ${POSTGRES_USER} \
      -d ${POSTGRES_DB} \
      -Fc \
      -f /backups/gridtrade-$(date +%Y%m%d).pgdump'
```

---

## Redis

Redis is used for cache and realtime pub/sub. Redis data is **ephemeral by design** — all durable data lives in PostgreSQL.

However, AOF persistence is enabled:

```yaml
# In docker-compose.production.yml:
redis:
  command: redis-server --appendonly yes
```

To backup Redis snapshot:

```bash
# Copy RDB snapshot from container
docker cp gridtrade-production-redis-1:/data/appendonly.aof ./redis-backup-$(date +%Y%m%d).aof
```

### Recovery

On Redis failure, the system degrades gracefully:
- API server continues serving (reads from PostgreSQL)
- Realtime SSE reconnects automatically
- Cache warms on first request

---

## Prisma Migrations

### Apply pending migrations in production

```bash
pnpm prisma migrate deploy
```

### Roll back a migration

Prisma does not support automatic rollback. For manual rollback:

1. Identify the last successful migration: `pnpm prisma migrate status`
2. Write a manual SQL rollback script
3. Apply: `psql "$DATABASE_URL" < rollback.sql`
4. Remove the failed migration file from `prisma/migrations/`

---

## Demo Data Reset

In development/demo environments only:

```bash
# Safe reset — refuses in production
pnpm demo:reset

# Or via API (DEMO_MODE=true required)
curl -X POST http://localhost:5000/api/v1/demo/reset \
  -H "Authorization: Bearer demo:admin"
```

---

## Retention Policy

| Data | Policy |
|---|---|
| PostgreSQL backups | Keep last 30 daily + last 4 weekly |
| Redis AOF | Rewrite daily (`BGREWRITEAOF`) |
| Log files | 7-day rolling rotation |
| Audit events (DB) | Never deleted — immutable ledger |
| SHA-256 hash records | Never deleted — cryptographic integrity |
