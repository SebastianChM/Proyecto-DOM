# Pre-Deployment Security Checklist

> **MANDATORY**: Complete this checklist before any production deployment.

## 1. Environment Variables

### Session & Secrets

- [ ] `SESSION_SECRET` is at least 32 random characters

  ```bash
  node -e "console.log(process.env.SESSION_SECRET?.length || 0)"
  # Expected: >= 32
  ```

- [ ] `WEBHOOK_SECRET` is at least 16 random characters
- [ ] No secrets use placeholder values like "CHANGE_ME"

### CORS Configuration

- [ ] `CORS_ORIGINS` contains ONLY your production domains
- [ ] `CORS_ORIGINS` does NOT contain `*` (wildcard)
- [ ] `ALLOW_NO_ORIGIN=false` in production

  ```bash
  grep ALLOW_NO_ORIGIN .env
  # Expected: ALLOW_NO_ORIGIN=false
  ```

### Admin Configuration

- [ ] `ADMIN_EMAILS` contains production admin emails
- [ ] `ALLOW_EMPTY_ADMIN_EMAILS=false` (or justified if true)

### Security Flags

- [ ] `ENABLE_DEBUG_ROUTES=false`
- [ ] `TRUST_PROXY=true` (if behind reverse proxy)
- [ ] `COOKIE_SECURE=true`
- [ ] `COOKIE_SAMESITE=lax` or `strict`
- [ ] `HSTS_ENABLED=true`

## 2. Rate Limiting

- [ ] `RATE_LIMIT_STORE=redis` (for distributed rate limiting)
- [ ] Redis is accessible and healthy

## 3. Database

- [ ] PostgreSQL (not SQLite)
- [ ] Connection string uses strong password
- [ ] Backups configured and tested (see [BACKUPS.md](./BACKUPS.md))

### Backup Verification

Follow the complete guide in [`docs/deploy/BACKUPS.md`](./BACKUPS.md).

**Quick Test:**

```bash
# Run backup
node tools/scripts/backup-db.js

# Verify backup created
ls -lh storage/backups/*.dump | tail -1
# Expected: Recent backup file (e.g., 42 MB)

# Test restore (interactive confirmation)
node tools/scripts/restore-db.js storage/backups/<latest-file>
```

---

## 4. Verification Commands

### Health Check

```bash
curl -s https://your-domain.com/health | jq
# Expected: {"services":{"database":"up","redis":"up"}}
```

### CORS Test (should fail)

```bash
curl -H "Origin: https://evil.com" -I https://your-domain.com/api/auth/me
# Expected: No Access-Control-Allow-Origin header
```

### Rate Limit Test

```bash
for i in {1..60}; do curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/api/auth/login; done
# Expected: Eventually returns 429
```

### Admin Access (should fail without admin)

```bash
curl -s https://your-domain.com/api/admin/status
# Expected: 401 Unauthorized
```

## 5. Backup Verification

See [`docs/deploy/BACKUPS.md`](./BACKUPS.md) for complete backup and restore guide.

**Quick verification:**

- [ ] Run backup: `node tools/scripts/backup-db.js`
- [ ] Verify backup file created in `storage/backups/` directory
- [ ] Test restore: Follow "Restore Testing & Verification" in BACKUPS.md
- [ ] Verify table count matches production
- [ ] Verify migration count matches production

---

## 6. PR Evidence Required

Attach the following to your deployment PR:

- [ ] Screenshot of health check response
- [ ] Screenshot of failed CORS test
- [ ] Screenshot of backup file listing
- [ ] Confirmation of all checklist items above

---

**Last Updated**: 2025-12-18
**Version**: 1.0.0
