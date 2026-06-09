# Hito 3 - Test Scripts

Acceptance tests for Hito 3 (Viewer Stable and Cheap)

## Prerequisites

1. API running on port 8080
2. Redis running
3. Bash environment (Git Bash on Windows)

## Tests

### Test 1: Simple Repetition ✅

**Validates**: Token caching

```bash
./test-1-simple-repetition.sh
```

**Expected**:

- Same `access_token` on repeat calls
- Second call shows `cacheHit: true` in logs

---

### Test 3: Concurrency ✅

**Validates**: Lock prevents token storm

```bash
./test-3-concurrency.sh
```

**Expected**:

- 20 parallel requests
- Only 1 unique token
- Logs show 1 APS call, ~19 lock waits

---

### Test 5: User Token Auth ✅

**Validates**: Strict session validation

```bash
# Without session
./test-5-user-token-auth.sh

# With session
export SESSION_COOKIE="dom-bim-session=YOUR_COOKIE"
./test-5-user-token-auth.sh
```

**Expected**:

- 401 without session (`USER_SESSION_REQUIRED`)
- 200 with valid session (includes `scope`)

---

## Log Verification

After running tests, check logs:

```bash
# Cache hits
grep "viewer_token_cache_hit" logs/api.log | tail -5

# Token generations
grep "viewer_token_generated" logs/api.log | tail -5

# Lock waits (concurrency)
grep "Lock held, waiting" logs/api.log | wc -l
```

---

## Expected Metrics

| Metric                             | Value                   |
| ---------------------------------- | ----------------------- |
| Cache hit ratio                    | >90% after initial call |
| Concurrent APS calls (20 requests) | 1                       |
| User token without session         | ❌ 401                  |
| User token with session            | ✅ 200                  |

---

## Full Test Run

```bash
# Run all tests
for test in test-*.sh; do
  echo "Running $test..."
  bash "$test"
  echo ""
  sleep 2
done
```
