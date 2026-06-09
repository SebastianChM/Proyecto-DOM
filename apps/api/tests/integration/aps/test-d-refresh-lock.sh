#!/bin/bash
# Test D: Token Refresh Lock Validation
# Verifies that concurrent requests trigger only one refresh

echo "========================================="
echo "Test D: Token Refresh Lock Validation"
echo "========================================="
echo ""

# Configuration
API_BASE="http://localhost:8080"
ENDPOINT="/api/aps/hubs"
NUM_CONCURRENT=10

echo "⚠️  PREREQUISITE: Token must be expiring soon (<120s remaining)"
echo ""
echo "To test this:"
echo "1. Login and get a session"
echo "2. Wait until token has <120s remaining"
echo "3. Or manually set expiresAt in Redis session to expire soon"
echo ""

# Check if session cookie is provided
if [ -z "$SESSION_COOKIE" ]; then
    echo "ERROR: SESSION_COOKIE environment variable not set"
    echo "Usage: SESSION_COOKIE='dom-bim-session=abc123...' $0"
    exit 1
fi

read -p "Is your token expiring soon (<120s)? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Test skipped. Token not in refresh window."
    exit 0
fi

echo "Sending $NUM_CONCURRENT concurrent requests..."
echo "Expected: Only 1 refresh execution"
echo ""

# Send concurrent requests
for i in $(seq 1 $NUM_CONCURRENT); do
    curl -s -X GET "$API_BASE$ENDPOINT" \
        -H "Cookie: $SESSION_COOKIE" \
        -H "x-request-id: test-refresh-$i" \
        -o /dev/null &
done

wait

echo ""
echo "✅ Requests completed"
echo ""
echo "Verification:"
echo "-------------------------------------------"
echo "Check logs for:"
echo ""
echo "1. One refresh execution:"
echo "   grep 'Starting token refresh' logs/api.log | grep -c 'test-refresh'"
echo "   Expected: 1"
echo ""
echo "2. Lock wait events:"
echo "   grep 'Refresh lock held' logs/api.log | grep -c 'test-refresh'"
echo "   Expected: ~9 (other requests waiting)"
echo ""
echo "3. Token reuse:"
echo "   grep 'Token refreshed by concurrent request' logs/api.log | grep -c 'test-refresh'"
echo "   Expected: ~9"
echo ""

# Try to count from logs if available
if [ -f "logs/api.log" ]; then
    echo ""
    echo "Automatic verification (from logs/api.log):"
    echo "-------------------------------------------"
    
    REFRESH_COUNT=$(grep 'Starting token refresh' logs/api.log | grep -c 'test-refresh' || echo "0")
    LOCK_WAIT_COUNT=$(grep 'Refresh lock held' logs/api.log | grep -c 'test-refresh' || echo "0")
    REUSE_COUNT=$(grep 'Token refreshed by concurrent request' logs/api.log | grep -c 'test-refresh' || echo "0")
    
    echo "Refresh executions: $REFRESH_COUNT (expected: 1)"
    echo "Lock waits:         $LOCK_WAIT_COUNT (expected: ~9)"
    echo "Token reuses:       $REUSE_COUNT (expected: ~9)"
    echo ""
    
    if [ "$REFRESH_COUNT" = "1" ] && [ "$LOCK_WAIT_COUNT" -gt "5" ]; then
        echo "✅ PASSED: Refresh lock is working"
    else
        echo "⚠️  Results unclear. Review logs manually."
    fi
else
    echo "Logs file not found. Review manually."
fi
