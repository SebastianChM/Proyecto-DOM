# Database Backup and Restore Guide

> **Production-Ready**: This guide provides reproducible backup and restore procedures without exposing credentials.

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [Manual Backup Commands](#2-manual-backup-commands)
3. [Automated Backup Script](#3-automated-backup-script)
4. [Restore Procedures](#4-restore-procedures)
5. [Backup Schedule & Retention](#5-backup-schedule--retention)
6. [Restore Testing & Verification](#6-restore-testing--verification)
7. [Docker Examples](#7-docker-examples)

---

## 1. Environment Variables

### Required Variables

Add these to your `.env` file (DO NOT commit actual values):

```bash
# Database Connection (Source)
POSTGRES_USER=CHANGE_ME_DB_USER
POSTGRES_PASSWORD=CHANGE_ME_DB_PASSWORD
POSTGRES_DB=dom_bim
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Backup Configuration
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30

# Optional: For remote backups
# S3_BUCKET=CHANGE_ME_BUCKET_NAME
# AWS_ACCESS_KEY_ID=CHANGE_ME_KEY
# AWS_SECRET_ACCESS_KEY=CHANGE_ME_SECRET
```

### Placeholders in `.env.example`

See `.env.example` for the complete list of placeholders. **NEVER** commit real credentials.

---

## 2. Manual Backup Commands

### Basic PostgreSQL Backup

```bash
# Set environment variables (DO NOT commit these)
export PGPASSWORD="YOUR_PASSWORD_HERE"

# Create backup directory
mkdir -p backups

# Backup with pg_dump (plain text SQL)
pg_dump -h localhost -p 5432 -U dom -d dom_bim \
  --clean --if-exists --verbose \
  > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Clear password from environment
unset PGPASSWORD
```

### Compressed Backup (Recommended)

```bash
export PGPASSWORD="YOUR_PASSWORD_HERE"

# Backup with custom format (smaller, supports parallel restore)
pg_dump -h localhost -p 5432 -U dom -d dom_bim \
  --format=custom --compress=9 --verbose \
  --file=backups/backup_$(date +%Y%m%d_%H%M%S).dump

unset PGPASSWORD
```

### Schema-Only Backup (for testing)

```bash
export PGPASSWORD="YOUR_PASSWORD_HERE"

pg_dump -h localhost -p 5432 -U dom -d dom_bim \
  --schema-only --verbose \
  > backups/schema_$(date +%Y%m%d_%H%M%S).sql

unset PGPASSWORD
```

---

## 3. Automated Backup Script

### Using the Provided Script

```bash
# Run backup script (reads from .env)
node scripts/backup-db.js

# Or with bash script
bash scripts/backup-db.sh

# With PowerShell (Windows)
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
```

### Backup Output

```text
✅ Backup completed successfully
📁 File: backups/backup_20251220_182530.dump
📊 Size: 42.3 MB
🕒 Duration: 12.4 seconds
```

**Security Note:** The script does NOT print connection strings or passwords to console.

---

## 4. Restore Procedures

### Restore to Local Database

```bash
export PGPASSWORD="YOUR_PASSWORD_HERE"

# Option 1: Restore from SQL file
psql -h localhost -p 5432 -U dom -d dom_bim \
  < backups/backup_20251220_182530.sql

# Option 2: Restore from custom format dump
pg_restore -h localhost -p 5432 -U dom -d dom_bim \
  --clean --if-exists --verbose \
  backups/backup_20251220_182530.dump

unset PGPASSWORD
```

### Restore to Different Database

```bash
export PGPASSWORD="YOUR_TARGET_PASSWORD_HERE"

# Create new database first
psql -h target-host -p 5432 -U dom -c "CREATE DATABASE dom_bim_restored;"

# Restore to new database
pg_restore -h target-host -p 5432 -U dom -d dom_bim_restored \
  --clean --if-exists --verbose \
  backups/backup_20251220_182530.dump

unset PGPASSWORD
```

### Restore Specific Tables

```bash
export PGPASSWORD="YOUR_PASSWORD_HERE"

# Restore only specific tables
pg_restore -h localhost -p 5432 -U dom -d dom_bim \
  --table=User --table=Project --table=File \
  backups/backup_20251220_182530.dump

unset PGPASSWORD
```

---

## 5. Backup Schedule & Retention

### Recommended Schedule

| Frequency   | Retention      | Use Case                |
| ----------- | -------------- | ----------------------- |
| **Hourly**  | Last 24 hours  | Recent changes recovery |
| **Daily**   | Last 30 days   | Point-in-time recovery  |
| **Weekly**  | Last 12 weeks  | Long-term recovery      |
| **Monthly** | Last 12 months | Compliance / Audit      |

### Cron Example (Production)

```bash
# Add to crontab with: crontab -e

# Hourly backups (keep last 24)
0 * * * * cd /path/to/project && node scripts/backup-db.js --retention=24h

# Daily backups (keep last 30 days)
0 2 * * * cd /path/to/project && node scripts/backup-db.js --retention=30d

# Weekly backups (every Sunday at 3am, keep 12 weeks)
0 3 * * 0 cd /path/to/project && node scripts/backup-db.js --retention=12w
```

### Cleanup Old Backups

```bash
# Delete backups older than 30 days
find backups/ -name "backup_*.dump" -mtime +30 -delete

# Or use the script with retention flag
node scripts/backup-db.js --cleanup --retention=30
```

---

## 6. Restore Testing & Verification

### Complete Restore Test (Step-by-Step)

#### Step 1: Create Test Database

```bash
export PGPASSWORD="YOUR_PASSWORD_HERE"

# Create test database
psql -h localhost -p 5432 -U dom -c "CREATE DATABASE dom_bim_test;"

# Verify creation
psql -h localhost -p 5432 -U dom -l | grep dom_bim_test
# Expected: dom_bim_test | dom | ...
```

#### Step 2: Restore Latest Backup

```bash
# Get latest backup file
LATEST_BACKUP=$(ls -t backups/backup_*.dump | head -1)
echo "Restoring from: $LATEST_BACKUP"

# Restore to test database
pg_restore -h localhost -p 5432 -U dom -d dom_bim_test \
  --clean --if-exists --verbose \
  "$LATEST_BACKUP"

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Restore completed successfully"
else
  echo "❌ Restore failed"
  exit 1
fi
```

#### Step 3: Verify Table Count

```bash
# Count tables in restored database
TABLE_COUNT=$(psql -h localhost -p 5432 -U dom -d dom_bim_test \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

echo "Tables restored: $TABLE_COUNT"

# Expected: Should match production (e.g., ~ 20-30 tables)
if [ "$TABLE_COUNT" -lt 10 ]; then
  echo "⚠️ Warning: Fewer tables than expected"
fi
```

#### Step 4: Verify Migration Status

```bash
# Check Prisma migrations
psql -h localhost -p 5432 -U dom -d dom_bim_test \
  -c "SELECT COUNT(*) as migration_count FROM _prisma_migrations;"

# Expected output:
#  migration_count
# -----------------
#              15
# (1 row)

# Compare with source database
SOURCE_MIGRATIONS=$(psql -h localhost -p 5432 -U dom -d dom_bim \
  -t -c "SELECT COUNT(*) FROM _prisma_migrations;")

TEST_MIGRATIONS=$(psql -h localhost -p 5432 -U dom -d dom_bim_test \
  -t -c "SELECT COUNT(*) FROM _prisma_migrations;")

if [ "$SOURCE_MIGRATIONS" = "$TEST_MIGRATIONS" ]; then
  echo "✅ Migration count matches: $SOURCE_MIGRATIONS"
else
  echo "❌ Migration mismatch: Source=$SOURCE_MIGRATIONS, Test=$TEST_MIGRATIONS"
fi
```

#### Step 5: Verify Row Counts

```bash
# Verify critical table row counts
psql -h localhost -p 5432 -U dom -d dom_bim_test -c "
  SELECT
    'User' as table_name, COUNT(*) as rows FROM \"User\"
  UNION ALL
  SELECT 'Project', COUNT(*) FROM \"Project\"
  UNION ALL
  SELECT 'File', COUNT(*) FROM \"File\"
  UNION ALL
  SELECT 'Conversion', COUNT(*) FROM \"Conversion\";
"

# Expected output example:
#  table_name | rows
# ------------+------
#  User       |   12
#  Project    |   45
#  File       |  234
#  Conversion |  189
```

#### Step 6: Cleanup Test Database

```bash
# Drop test database after verification
psql -h localhost -p 5432 -U dom -c "DROP DATABASE dom_bim_test;"

unset PGPASSWORD

echo "✅ Restore test completed successfully"
```

### Automated Verification Script

```bash
# Run automated restore test
node scripts/test-restore.js --backup=latest

# Output:
# 🔄 Starting restore test...
# ✅ Test database created
# ✅ Backup restored
# ✅ Table count: 28 (expected: 28)
# ✅ Migration count: 15 (expected: 15)
# ✅ Row counts verified
# ✅ Test database dropped
#
# ✅ Restore test PASSED
```

---

## 7. Docker Examples

### Backup from Docker Container

```bash
# Backup directly from Docker container
docker exec dom-bim-db pg_dump -U dom -d dom_bim \
  --format=custom --compress=9 \
  > backups/backup_$(date +%Y%m%d_%H%M%S).dump

# Or exec into container and run pg_dump
docker exec -it dom-bim-db bash
pg_dump -U dom -d dom_bim --format=custom --compress=9 \
  > /tmp/backup.dump
exit

# Copy backup out of container
docker cp dom-bim-db:/tmp/backup.dump backups/
```

### Restore to Docker Container

```bash
# Option 1: Pipe backup into container
cat backups/backup_20251220_182530.dump | \
  docker exec -i dom-bim-db pg_restore -U dom -d dom_bim --clean

# Option 2: Copy backup into container
docker cp backups/backup_20251220_182530.dump dom-bim-db:/tmp/
docker exec -it dom-bim-db pg_restore -U dom -d dom_bim \
  --clean /tmp/backup_20251220_182530.dump
```

### Docker Compose Backup Service

Add to `docker-compose.yml`:

```yaml
services:
  backup:
    image: postgres:15-alpine
    container_name: dom-bim-backup
    environment:
      PGHOST: postgres
      PGPORT: 5432
      PGUSER: ${POSTGRES_USER}
      PGPASSWORD: ${POSTGRES_PASSWORD} # ⚠️ Use secrets in production
      PGDATABASE: ${POSTGRES_DB}
    volumes:
      - ./backups:/backups
    networks:
      - dom-network
    command: >
      sh -c "
      pg_dump --format=custom --compress=9 --verbose
      --file=/backups/backup_$$(date +%Y%m%d_%H%M%S).dump
      "
    depends_on:
      - postgres
```

**Security Note:** Use Docker secrets instead of environment variables in production:

```yaml
services:
  backup:
    secrets:
      - db_password
    environment:
      PGPASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt # NOT in repo
```

---

## Security Checklist

Before running backups in production:

- [ ] ✅ `.env` is in `.gitignore`
- [ ] ✅ Backup scripts do NOT print connection strings
- [ ] ✅ Backup files are excluded from version control (add `backups/` to `.gitignore`)
- [ ] ✅ Credentials use environment variables or secrets manager
- [ ] ✅ Backups are stored encrypted if containing sensitive data
- [ ] ✅ Restore test completed successfully

---

## Troubleshooting

### "pg_dump: command not found"

Install PostgreSQL client tools:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql@15

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### "FATAL: password authentication failed"

1. Verify credentials in `.env`
2. Check `POSTGRES_PASSWORD` matches database password
3. Ensure `.pgpass` file (if used) has correct permissions: `chmod 600 ~/.pgpass`

### Backup file is empty

1. Check disk space: `df -h`
2. Verify database has data: `psql -c "SELECT COUNT(*) FROM \"User\";"`
3. Check pg_dump exit code and stderr output

---

**Last Updated**: 2025-12-20  
**Version**: 1.0.0  
**Hito**: 1 - Security Hardening
