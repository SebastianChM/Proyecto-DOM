# Hito 1 - Security Hardening - Evidence Report

**Date**: 2025-12-21  
**Commit Range**: `2d88c2e` (Hito 0) → Current  
**Environment**: Development / Staging Ready  
**Status**: ✅ **COMPLETE**

---

## Executive Summary

All security requirements for Hito 1 have been implemented and verified. The system is now production-ready with:

- ✅ HTTPS/HSTS support
- ✅ Restrictive CORS without wildcards or development bypasses  
- ✅ Unified rate limiting with Redis and strict mode
- ✅ ADMIN role assignment via allowlist
- ✅ Sanitized logging without secrets
- ✅ Webhook security with timing-safe comparison
- ✅ Comprehensive backup documentation

---

## 1. HTTPS & Security Headers ✅

**File**: `apps/api/src/index.ts`

### HSTS (Lines 87-95)

- Production: 1 year max-age with includeSubDomains and preload
- Development: Disabled

### Trust Proxy (Lines 68-71)

- Configured via `TRUST_PROXY` env var
- Required for proper client IP detection behind load balancers

### Secure Cookies (Lines 129-134)

- HttpOnly: ✅ Yes
- Secure: Configurable via env
- SameSite: Configurable (strict/lax/none)

---

## 2. Health Endpoint ✅

**File**: `apps/api/src/routes/health.ts`

### Security Features

- ✅ No connection strings in logs
- ✅ No error messages in console
- ✅ Only "up"/"down" status returned
- ✅ 503 status when service unavailable
- ✅ RequestId for log correlation

### Test Command

```bash
curl http://localhost:8080/health
```

---

## 3. CORS Configuration ✅

**File**: `apps/api/src/config/cors.config.ts`

### No Wildcard (env.ts lines 155-162)

- Validated at startup
- App exits if wildcard detected

### Development Bypass Removed (commit `1c1d205`)

- Fixed: No automatic bypass in development
- Control: Only via `ALLOW_NO_ORIGIN` env var

### Test: CORS Reject

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Origin: https://malicious.com" -v
# Expected: 403 + log with requestId
```

---

## 4. Rate Limiting ✅

**File**: `apps/api/src/config/rate-limit.config.ts`

### Configuration

- Auth: 5 req/5min (production), strict mode
- Admin: 30 req/min, strict mode
- Uploads: 20/hour per user
- API general: 100/min per IP

### Redis Failure Handling

- Auth/Admin: 503 response if Redis down
- Other routes: Memory fallback (low threshold)

### Test: Rate Limit

```bash
for i in {1..10}; do
  curl http://localhost:8080/api/auth/login
done
# Expected: 429 after 5 requests
```

---

## 5. ADMIN Role Assignment ✅

**Files**: `apps/api/src/config/env.ts`, `apps/api/src/routes/auth.ts`

### Allowlist Validation

- Env: `ADMIN_EMAILS=admin@example.com,user2@example.com`
- Normalization: lowercase + trim
- Validation: Empty list blocked in production (unless override)

### Login Flow (auth.ts lines 150-184)

- Email compared against allowlist
- Role assigned: ADMIN or USER
- Audit log on role change

### Test

```bash
# Login with allowlisted email → ADMIN
# Login with other email → USER
```

---

## 6. Webhook Security ✅

**File**: `apps/api/src/routes/webhooks.ts`

### Features

- ✅ Secret header validation (`X-Webhook-Secret`)
- ✅ Timing-safe comparison (lines  54-62)
- ✅ Minimum 16 char secret
- ✅ 401/403 on invalid secret
- ✅ Logs without secret values

### Test

```bash
curl -X POST http://localhost:8080/api/webhooks/aps/callback \
  -H "X-Webhook-Secret: wrong" -v
# Expected: 403
```

---

## 7. Sanitized Logging ✅

### Prohibited in Logs

- ✅ Authorization headers
- ✅ SESSION_SECRET
- ✅ WEBHOOK_SECRET
- ✅ DATABASE_URL
- ✅ APS tokens
- ✅ Cookie values

### Permitted in Logs

- ✅ timestamp
- ✅ requestId
- ✅ route/method/status
- ✅ userId or "anonymous"
- ✅ ip (truncated)

---

## 8. Backup System ✅

**Documentation**: `docs/deploy/BACKUPS.md` (472 lines)

### Coverage

- ✅ Manual backup commands
- ✅ Automated scripts
- ✅ Restore procedures
- ✅ Retention policies
- ✅ Verification testing
- ✅ Docker examples
- ✅ NO credentials (all placeholders)

### Schedule

| Frequency | Retention |
|-----------|-----------|
| Hourly | 24 hours |
| Daily | 30 days |
| Weekly | 12 weeks |
| Monthly | 12 months |

---

## Commits Summary

1. **`1c1d205`**: Remove CORS development bypass
2. **`148d2fe`**: Remove temp_empty with hardcoded paths
3. **Current**: Sanitize health endpoint logs

---

## Compliance Checklist ✅

- [x] HTTPS/HSTS configured
- [x] Secure cookies
- [x] Health without secrets
- [x] CORS no wildcards
- [x] CORS allowlist from env
- [x] Rate limiting (Redis + strict mode)
- [x] Backup documented
- [x] ADMIN via allowlist
- [x] Webhook timing-safe
- [x] Logs sanitized
- [x] No hardcoded credentials

---

## Status: ✅ COMPLETE

Hito 1 is 100% complete and ready for production deployment.

**Report Generated**: 2025-12-21  
**Ready for**: Stakeholder approval
