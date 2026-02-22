-- Hito 4: Database Verification Queries
-- Run these to verify webhook system integrity

-- 1. Check webhook_delivery table exists and structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'webhook_delivery'
ORDER BY ordinal_position;

-- 2. Check notification_event table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notification_event'
ORDER BY ordinal_position;

-- 3. Check aps_poll_cursor table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'aps_poll_cursor'
ORDER BY ordinal_position;

-- 4. Verify unique constraint on dedupe_key
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'webhook_delivery'
  AND constraint_type = 'UNIQUE';

-- 5. Count webhook deliveries by status
SELECT status, COUNT(*) as count
FROM webhook_delivery
GROUP BY status
ORDER BY count DESC;

-- 6. Check for duplicate dedupe_keys (should be ZERO)
SELECT dedupe_key, COUNT(*) as duplicate_count
FROM webhook_delivery
GROUP BY dedupe_key
HAVING COUNT(*) > 1;

-- 7. Recent webhook deliveries (last 10)
SELECT 
    id,
    provider,
    event_type,
    status,
    attempts,
    received_at,
    processed_at,
    EXTRACT(EPOCH FROM (processed_at - received_at)) as processing_seconds
FROM webhook_delivery
ORDER BY received_at DESC
LIMIT 10;

-- 8. Failed deliveries with errors
SELECT 
    id,
    event_type,
    status,
    attempts,
    last_error,
    received_at
FROM webhook_delivery
WHERE status = 'FAILED'
ORDER BY received_at DESC
LIMIT 5;

-- 9. Notification events by type
SELECT type, COUNT(*) as count
FROM notification_event
GROUP BY type
ORDER BY count DESC;

-- 10. Active polling cursors
SELECT 
    id,
    project_id,
    poll_status,
    last_poll_at,
    error_count,
    last_error
FROM aps_poll_cursor
WHERE poll_status = 'ACTIVE';
