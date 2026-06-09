# Hito 2 - Test Scripts

This directory contains acceptance test scripts for Hito 2 (APS Integration Centralization).

## Prerequisites

1. **API Running**: `npm run dev` from project root
2. **Session Cookie**: Login and extract your session cookie
3. **Bash Environment**: Git Bash (Windows) or native bash (Linux/Mac)

## Getting Your Session Cookie

1. Login to the application
2. Open browser DevTools → Application → Cookies
3. Copy the value of `dom-bim-session` cookie
4. Export as environment variable:

```bash
export SESSION_COOKIE="dom-bim-session=YOUR_COOKIE_VALUE_HERE"
```

## Test Scripts

### Test A: Cache Hit Validation

Tests that cache reduces APS API calls.

```bash
SESSION_COOKIE="dom-bim-session=..." ./test-a-cache-hit.sh
```

**Expected**:

- First call: Cache miss, APS call made
- Second call: Cache hit, NO APS call

---

### Test B: Rate Limiting

Tests that rate limiter blocks excessive requests.

```bash
SESSION_COOKIE="dom-bim-session=..." ./test-b-rate-limit.sh
```

**Expected**:

- ~30 requests succeed (200)
- Rest get rate limited (429)

---

### Test C: Redis Down (Fail-Closed)

Tests that service returns 503 when Redis is unavailable.

```bash
SESSION_COOKIE="dom-bim-session=..." ./test-c-redis-down.sh
```

**Expected**:

- API returns 503 when Redis down
- No APS calls made
- Service recovers after Redis restart

⚠️ **WARNING**: This test stops and restarts the Redis container.

---

### Test D: Token Refresh Lock

Tests that concurrent requests trigger only one token refresh.

```bash
SESSION_COOKIE="dom-bim-session=..." ./test-d-refresh-lock.sh
```

**Expected**:

- Only 1 refresh execution
- Other requests wait and reuse new token

⚠️ **PREREQUISITE**: Token must be expiring soon (<120s remaining)

---

### Test E: Error Type Mapping

Tests that errors are correctly normalized.

```bash
./test-e-error-types.sh
```

**Expected**:

- Invalid session → 401 APS_REFRESH_REQUIRED
- Standardized JSON format

---

## Running All Tests

```bash
# Set session cookie
export SESSION_COOKIE="dom-bim-session=YOUR_VALUE"

# Run tests
./test-a-cache-hit.sh
./test-b-rate-limit.sh
./test-c-redis-down.sh
# ./test-d-refresh-lock.sh  # Only if token expiring
./test-e-error-types.sh
```

## Interpreting Results

All tests include:

- ✅ Success indicators
- ❌ Failure indicators
- Log verification commands

Check API logs for detailed metrics:

```bash
# Cache metrics
grep "aps_cache_hit" logs/api.log
grep "aps_cache_miss" logs/api.log

# Rate limit metrics
grep "aps_outbound_total" logs/api.log
grep "aps_outbound_blocked" logs/api.log

# Redis failure events
grep "redis_unavailable_outbound_limit" logs/api.log
```

## Notes

- Tests use `curl` with `-s` (silent) and `-w` (write output format)
- JSON responses are prettified with Python (if available)
- All tests include requestId for log correlation
- Tests are safe to run multiple times

## Troubleshooting

**"SESSION_COOKIE not set"**:
Export your cookie before running tests.

**"Connection refused"**:
Ensure API is running on port 8080.

**"Redis container not found"**:
Ensure Docker is running and Redis container exists.

**Test D shows no refresh**:
Token must be <120s from expiration. Login with a fresh token first.
