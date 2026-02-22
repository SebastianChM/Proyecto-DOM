# Hito 4: Secure APS Webhooks - Test Suite

## Prerequisites

1. **API Running**: `npm run dev` in `apps/api`
2. **Redis Running**: Redis must be accessible
3. **Environment Variables**:

   ```bash
   export APS_WEBHOOK_SIGNING_SECRET="your-secret-here"
   ```

4. **Tools**: `curl`, `jq`, `bc`, `openssl`

## Test Scripts

### 1. HMAC Validation (`test-hmac-validation.sh`)

Tests signature validation with:

- Invalid signature → 403/401
- Valid HMAC-SHA256 signature → 202
- Missing signature → 401

**Run**:

```bash
cd apps/api/tests/hito4
bash test-hmac-validation.sh
```

**Expected**:

```
✅ PASS: Invalid signature correctly rejected
✅ PASS: Valid signature accepted, webhook enqueued
✅ PASS: Missing signature correctly rejected
```

### 2. Latency Test (`test-latency.sh`)

Verifies webhook responds in < 5 seconds.

**Run**:

```bash
bash test-latency.sh
```

**Expected**:

```
Response Status: 202
Total Time: 0.123s
✅ PASS: Response time 0.123s < 5s
```

### 3. Idempotency Test (`test-idempotency.sh`)

Sends same webhook twice, verifies no duplication.

**Run**:

```bash
bash test-idempotency.sh
```

**Expected**:

```
✅ First webhook: ENQUEUED
✅ Second webhook: DUPLICATE
✅ PASS: Same deliveryId returned
```

### 4. Queue Processing (Manual)

Verify worker processes jobs:

```bash
# Start worker
npm run worker:webhooks

# Send webhook
bash test-hmac-validation.sh

# Check database
psql -d dom_bim -c "SELECT id, event_type, status FROM webhook_delivery ORDER BY created_at DESC LIMIT 5;"
```

**Expected**: Status transitions from `PENDING` → `PROCESSED`

## Database Verification

### Check webhook deliveries

```sql
SELECT
  id,
  provider,
  event_type,
  status,
  attempts,
  received_at,
  processed_at
FROM webhook_delivery
ORDER BY received_at DESC
LIMIT 10;
```

### Check notifications

```sql
SELECT
  id,
  type,
  project_id,
  resource_id,
  created_at
FROM notification_event
ORDER BY created_at DESC
LIMIT 10;
```

### Check dedupe (idempotency)

```sql
SELECT
  dedupe_key,
  COUNT(*) as count
FROM webhook_delivery
GROUP BY dedupe_key
HAVING COUNT(*) > 1;
```

**Expected**: Zero rows (no duplicates)

## Redis Verification

### Check queue

```bash
# Count jobs in queue
redis-cli LLEN "dom-bim:aps-webhooks:wait"

# Check job details
redis-cli LRANGE "dom-bim:aps-webhooks:wait" 0 -1
```

## Logs Verification

Logs should NEVER contain:

- ❌ Full webhook payloads
- ❌ Authorization headers
- ❌ APS tokens
- ❌ Refresh tokens
- ❌ Signing secrets
- ❌ Session secrets

Logs SHOULD contain:

- ✅ requestId
- ✅ event type
- ✅ hook ID
- ✅ delivery ID
- ✅ status codes
- ✅ duration times

## Troubleshooting

### HMAC Test Fails

1. Check `APS_WEBHOOK_SIGNING_SECRET` is set
2. Verify secret matches between test and `.env`
3. Check OpenSSL is installed: `openssl version`

### Idempotency Test Fails

1. Check Redis is running: `redis-cli ping`
2. Verify database connection
3. Check unique constraint on `dedupe_key`

### Worker Not Processing

1. Start worker: `npm run worker:webhooks`
2. Check Redis connection in worker logs
3. Verify `RUN_WORKERS=true` if using combined process

## Success Criteria

- ✅ HMAC validation blocks invalid signatures
- ✅ Webhook responses < 5 seconds
- ✅ Duplicate webhooks detected
- ✅ Jobs processed by worker
- ✅ Notifications created
- ✅ No sensitive data in logs
