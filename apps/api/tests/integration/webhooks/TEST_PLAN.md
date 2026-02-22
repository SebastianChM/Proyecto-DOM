# Hito 4: Test Plan - Secure APS Webhooks

## Test Environment

- **Date**: 2025-12-22
- **Database**: PostgreSQL (dom_bim)
- **API**: <http://localhost:8080>
- **Test Location**: apps/api/tests/hito4/

## Test Cases by Feature

### Feature 1: HMAC Signature Validation

**TC1.1: Invalid Signature - Should Reject (403)**

- Command: Send POST with wrong HMAC signature
- Expected: HTTP 403, error message "WEBHOOK_HMAC_INVALID"
- Measures: Response time < 1s

**TC1.2: Missing Signature - Should Reject (401)**

- Command: Send POST without x-adsk-signature header
- Expected: HTTP 401, error message "WEBHOOK_HMAC_MISSING"
- Measures: Response time < 1s

**TC1.3: Valid Signature - Should Accept (202)**

- Command: Send POST with correct HMAC-SHA256 signature
- Expected: HTTP 202, deliveryId in response
- Measures: Response time < 5s (SLA requirement)

**TC1.4: Timing Attack Prevention**

- Command: Send multiple invalid signatures
- Expected: Consistent response times (timing-safe comparison)
- Measures: Standard deviation < 10ms

### Feature 2: Idempotency

**TC2.1: First Delivery - Should Process**

- Command: Send unique webhook event
- Expected: HTTP 202, status="ENQUEUED"
- Database: 1 row in webhook_delivery, status=PENDING

**TC2.2: Duplicate Delivery - Should Detect**

- Command: Send same webhook event again (same dedupe_key)
- Expected: HTTP 202, status="DUPLICATE"
- Database: Still 1 row, no new insert

**TC2.3: Concurrent Duplicates - Race Condition**

- Command: Send 5 simultaneous identical webhooks
- Expected: Only 1 inserted to DB
- Database: Verify unique constraint on dedupe_key

### Feature 3: Async Processing

**TC3.1: Queue Enqueue - Immediate Response**

- Command: Send valid webhook
- Expected: HTTP 202 in < 5s
- Queue: Job exists in Redis "aps-webhooks" queue

**TC3.2: Worker Processing - Design Automation Callback**

- Command: Send design-automation.callback event
- Expected: Conversion status updated to COMPLETED
- Database: webhook_delivery status=PROCESSED

**TC3.3: Worker Processing - Version Added**

- Command: Send dm.version.added event
- Expected: New file record created, translation job enqueued
- Database: New row in files table

**TC3.4: Worker Retry on Failure**

- Command: Send webhook causing processing error
- Expected: Job retried 3 times with exponential backoff
- Database: attempts=3, lastError populated

### Feature 4: Rate Limiting

**TC4.1: Normal Traffic - Should Allow**

- Command: Send 50 requests in 1 minute
- Expected: All return HTTP 202
- Measures: 0 rate-limited requests

**TC4.2: Excessive Traffic - Should Throttle**

- Command: Send 150 requests in 1 minute
- Expected: First 100 return 202, rest return 429
- Response: "TOO_MANY_REQUESTS" error

### Feature 5: Logging Security

**TC5.1: No Secrets in Logs**

- Command: Send webhook and check logs
- Expected: NO tokens, NO secrets, NO full payloads
- Verified: Only hookId, eventType, deliveryId, hasPayload

**TC5.2: Sanitized Payload Logging**

- Command: Send webhook with large payload (10KB)
- Expected: Logs show hasPayload:true, NOT full body
- Measures: Log size < 500 bytes per webhook

### Feature 6: Polling Backup

**TC6.1: Initialize Poll Cursor**

- Command: Call pollingService.initializeProjectCursor()
- Expected: New row in aps_poll_cursor, status=ACTIVE
- Database: Verify cursor created

**TC6.2: Poll Active Projects**

- Command: Call pollingService.pollAllProjects()
- Expected: lastPollAt updated, errorCount=0
- Database: Cursor timestamp updated

**TC6.3: Error Handling - Pause After 5 Failures**

- Command: Trigger 5 consecutive polling errors
- Expected: pollStatus changes to FAILED
- Database: errorCount=5, pollStatus=FAILED

## Test Execution Strategy

### Phase 1: Unit Tests (Manual Commands)

1. HMAC validation (TC1.1-1.4)
2. Idempotency (TC2.1-2.3)
3. Rate limiting (TC4.1-4.2)

### Phase 2: Integration Tests (With Worker)

1. Async processing (TC3.1-3.4)
2. Polling backup (TC6.1-6.3)

### Phase 3: Security Audit

1. Log sanitization (TC5.1-5.2)
2. Secret exposure scan
3. Timing attack verification

## Test Scripts

- `test-hmac-validation.sh` - TC1.1, TC1.2, TC1.3
- `test-latency.sh` - TC1.3 (timing measurement)
- `test-idempotency.sh` - TC2.1, TC2.2
- `test-rate-limiting.sh` - TC4.1, TC4.2
- `verify-database.sql` - Database state validation
- `verify-logs.sh` - Log sanitization check

## Success Criteria

✅ All HTTP status codes match expected
✅ Response times meet SLA (< 5s for webhook, < 1s for validation)
✅ Zero duplicate deliveries in database
✅ Zero secrets/tokens in logs
✅ Rate limiting enforces 100 req/min per IP
✅ Worker processes all job types successfully
