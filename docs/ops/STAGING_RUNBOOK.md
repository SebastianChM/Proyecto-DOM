# Staging Deployment Runbook

Procedimiento paso a paso para deploy en staging. Cada paso tiene un comando real verificable.

---

## Prerequisites

- SSH/terminal access to the staging host
- Docker and Docker Compose installed on staging host
- `apps/api/.env` configured on the host with valid:
  - `DATABASE_URL` (PostgreSQL connection string)
  - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - `SESSION_SECRET` (min 32 chars)
  - `CORS_ORIGINS` (staging frontend URL)
  - `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_CALLBACK_URL`
  - `NODE_ENV=production`
- PostgreSQL and Redis running (via docker-compose or external)
- `pg_dump` available (locally or via Docker container `dom-bim-db`)

---

## 1. Pre-Deploy: Backup Database

**Always backup before deploy.** Never skip this step.

```bash
# From project root
node tools/scripts/backup-db.js

# Verify backup was created
ls -lh storage/backups/*.dump | tail -1
```

Expected output:

```
[backup ...] ✅ Backup completed successfully
📁 File: storage/backups/dom_bim_YYYY-MM-DD_HH-MM-SS.dump
```

If `pg_dump` isn't local, the script auto-falls back to `docker exec dom-bim-db`.

---

## 2. Pull Latest Code

```bash
git fetch origin
git checkout main
git pull origin main
```

---

## 3. Install Dependencies

```bash
npm ci
```

---

## 4. Run Database Migrations

```bash
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

This applies only pending migrations. It does **not** reset data.

If migration fails:

```bash
# Check migration status
npx prisma migrate status --schema packages/database/prisma/schema.prisma

# If needed, restore from backup (see step 8)
```

---

## 5. Build and Deploy

### Option A: Docker Compose (recommended)

```bash
cd infra/docker
docker compose build api
docker compose up -d api worker
```

### Option B: Direct Node.js

```bash
npm run build --workspace=apps/api
npx prisma generate --schema packages/database/prisma/schema.prisma
node apps/api/dist/src/index.js
```

---

## 6. Smoke Tests Post-Deploy

### Health Check

```bash
curl -s http://localhost:8080/health | jq .
```

Expected:

```json
{
  "uptime": 12.5,
  "version": "1.0.0",
  "services": {
    "database": "up",
    "redis": "up"
  },
  "env": "production"
}
```

### Interpreting Health Results

| Field                | Expected             | If Wrong                                           |
| -------------------- | -------------------- | -------------------------------------------------- |
| `database: "up"`     | PostgreSQL connected | Check `DATABASE_URL`, pg container status          |
| `database: "down"`   | —                    | `docker compose ps postgres`, check logs           |
| `redis: "up"`        | Redis connected      | Check `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| `redis: "down"`      | —                    | `docker compose ps redis`, `redis-cli ping`        |
| `version: "unknown"` | —                    | `package.json` not found in dist — rebuild         |

### API Smoke

```bash
# Auth endpoint responds
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/auth/me
# Expected: 401 (not logged in, but endpoint works)

# CORS blocks unknown origins
curl -s -H "Origin: https://evil.com" -o /dev/null -w "%{http_code}" http://localhost:8080/api/auth/me
# Expected: no Access-Control-Allow-Origin header
```

---

## 7. Check Logs

```bash
# Docker
docker compose logs api --tail 50
docker compose logs worker --tail 50

# Direct
tail -50 apps/api/logs/*.log
```

Look for:

- `[ERROR]` lines — investigate immediately
- `[WARN]` lines — check if expected (rate limits, missing optional config)
- `Server running on port 8080` — confirms startup
- `Redis connected` — confirms cache/queue layer

---

## 8. Rollback

### If deploy failed or app is broken:

**Step 1: Restore previous version**

```bash
# Docker: roll back to previous image
docker compose up -d --force-recreate api worker

# Or: checkout previous commit
git checkout HEAD~1
npm ci
npm run build --workspace=apps/api
```

**Step 2: Restore database (if migration caused issues)**

```bash
# List available backups
ls -lh storage/backups/

# Restore (interactive confirmation required)
node tools/scripts/restore-db.js storage/backups/<backup-file>

# In production, requires explicit flag
node tools/scripts/restore-db.js storage/backups/<backup-file> --i-know-what-i-am-doing
```

**Step 3: Verify rollback**

```bash
curl -s http://localhost:8080/health | jq .
```

---

## 9. Common Issues

### Database is down

```bash
# Check postgres container
docker compose ps postgres
docker compose logs postgres --tail 20

# Restart if needed
docker compose restart postgres

# Wait for healthy
docker compose exec postgres pg_isready -U dom-bim -d dom_bim
```

### Redis is down

```bash
# Check redis container
docker compose ps redis
docker compose logs redis --tail 20

# Restart
docker compose restart redis

# Test connection
docker compose exec redis redis-cli ping
```

### Transport disabled / Sentry/SMTP not configured

These are **optional** integrations. The app runs without them:

- `SENTRY_DSN` not set → error tracking disabled (logged to console)
- `SMTP_HOST` not set → email notifications disabled
- App warns at startup but continues normally

### Port already in use

```bash
# Find what's using port 8080
lsof -i :8080
# Or on the Docker host
docker ps --filter publish=8080
```
