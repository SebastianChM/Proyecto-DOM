# Hito 2 - APS Integration Centralization - Evidence Report

**Date**: 2025-12-21  
**Status**: ✅ **IMPLEMENTATION COMPLETE**  
**Ready for**: Testing & Validation

---

## Executive Summary

Hito 2 centralizes all APS integration through a unified service with:

- ✅ Token refresh with early refresh and Redis locks
- ✅ Redis caching with stampede prevention
- ✅ Fail-closed rate limiting
- ✅ Normalized error handling
- ✅ Clean router with standardized responses

**Cost Impact**: Expected 60-80% reduction in APS API calls through caching

---

## Implementation Completed

### 1. Token Management ✅

**File**: `apps/api/src/services/aps/token-refresh.service.ts` (270 lines)

**Features**:

- Early refresh at 120s threshold
- Redis lock: `aps:refresh-lock:user:{userId}` (TTL 15s)
- Retry with 200ms backoff, max 10 retries
- Clear session on `invalid_grant`

---

### 2. Rate Limiting - FAIL CLOSED ✅

**File**: `apps/api/src/services/aps/aps-outbound-rate-limit.ts` (220 lines)

**Configuration**:

- Global: 90 req/min
- Per-user: 30 req/min
- **FAIL CLOSED**: Throws 503 if Redis fails

**Metrics**: `aps_outbound_total`, `aps_outbound_blocked`

---

### 3. Caching with Anti-Stampede ✅

**File**: `apps/api/src/services/aps/aps-cache.ts` (280 lines)

**Features**:

- Cache-aside pattern with `getOrFetch()`
- Redis locks for deduplication
- Keys include: userId, scope, version

**Metrics**: `aps_cache_hit`, `aps_cache_miss`

---

### 4. Integration Service ✅

**File**: `apps/api/src/services/aps/aps-integration.service.ts` (200 lines)

**Methods**:

- `getHubsForUser(req)` - TTL 300s
- `getProjectsForHub(req, hubId)` - TTL 300s
- `getFolderContents(req, projectId, folderId)` - TTL 60s

---

### 5. Router Refactoring ✅

**File**: `apps/api/src/routes/aps-proxy.ts` (90 lines, was 131)

**Changes**:

- ❌ Deleted: `getAccessToken()` (68 lines)
- ✅ Standardized error format with requestId

---

## Test Commands

### Test A: Cache Hit

```bash
curl http://localhost:8080/api/aps/hubs -H "Cookie: ..."
# Second call should show cache hit
```

### Test B: Rate Limit

```bash
for i in {1..50}; do curl http://localhost:8080/api/aps/hubs & done
# Should get 429 after ~30 requests
```

### Test C: Redis Down

```bash
docker stop dom-redis
curl http://localhost:8080/api/aps/hubs
# Should get 503
```

---

## Code Changes

**New Files** (5): 1180 lines  
**Modified Files** (2): -100 lines  
**Net**: +1080 lines

---

## Status

✅ **READY FOR TESTING**

All implementation complete. Awaiting validation.
