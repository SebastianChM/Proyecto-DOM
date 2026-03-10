# Database Backup and Restore

> Procedures for backing up and restoring the PostgreSQL database.

---

## Prerequisites

- **DATABASE_URL** set in `apps/api/.env` (standard PostgreSQL URL format)
- **pg_dump / pg_restore** available via one of:
  - PostgreSQL client tools installed locally
  - Docker postgres container running (`dom-bim-db`)
- Scripts auto-detect which method is available

---

## Backup

```bash
# Standard backup (custom format, compressed)
node tools/scripts/backup-db.js

# Plain SQL format
node tools/scripts/backup-db.js --format=sql

# Dry run (show command without executing)
node tools/scripts/backup-db.js --dry-run
```

Output files land in `storage/backups/` with the naming pattern:

```
storage/backups/<dbname>_YYYY-MM-DD_HH-MM-SS.dump   # custom format
storage/backups/<dbname>_YYYY-MM-DD_HH-MM-SS.sql     # SQL format
```

The script:

- Reads `DATABASE_URL` from environment or `apps/api/.env`
- Never prints passwords or full connection strings
- Tries local `pg_dump` first, falls back to `docker exec` if not in PATH
- Fails with a clear message if neither is available

---

## Restore

```bash
# Restore with interactive confirmation
node tools/scripts/restore-db.js storage/backups/<backup-file>

# Skip confirmation prompt
node tools/scripts/restore-db.js storage/backups/<backup-file> --confirm

# Dry run
node tools/scripts/restore-db.js storage/backups/<backup-file> --dry-run
```

### Guardrails

| Condition                 | Behavior                                                     |
| ------------------------- | ------------------------------------------------------------ |
| No `--confirm` flag       | Asks for interactive "yes" confirmation                      |
| `NODE_ENV=production`     | **Blocked** unless `--i-know-what-i-am-doing` flag is passed |
| File not found            | Fails with clear error                                       |
| pg_restore/psql not found | Fails with installation instructions                         |
| No `DATABASE_URL`         | Fails with clear error                                       |

The script auto-detects `.dump` (custom format → `pg_restore`) vs `.sql` (plain text → `psql`).

---

## Backup Storage

- Files go to `storage/backups/` (already in `.gitignore`)
- Custom format (`.dump`) recommended: smaller files, supports parallel restore
- No automatic retention/cleanup — manage manually or via cron

---

## Docker Compose (Direct)

If you prefer to run pg_dump directly against the Docker container:

```bash
# Backup
docker exec dom-bim-db pg_dump -U dom -d dom_bim \
  --format=custom --compress=6 \
  > storage/backups/manual_backup.dump

# Restore
docker exec -i dom-bim-db pg_restore -U dom -d dom_bim \
  --clean --if-exists \
  < storage/backups/manual_backup.dump
```

---

## Troubleshooting

### "pg_dump not found"

Install PostgreSQL client tools or start the Docker container:

```bash
# Start just the database container
docker compose -f infra/docker/docker-compose.yml up -d postgres
```

### "DATABASE_URL is not set"

Ensure `apps/api/.env` contains a valid `DATABASE_URL`:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### pg_restore warnings

`pg_restore` often emits warnings about objects that don't exist when using `--clean`. This is normal — the restore still succeeds.
