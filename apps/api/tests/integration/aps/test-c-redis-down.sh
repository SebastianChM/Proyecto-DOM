#!/bin/bash
# Test C: Redis Down - Fail Closed Validation
# Verifies that service returns 503 when Redis is unavailable

echo "========================================="
echo "Test C: Redis Down - Fail Closed"
echo "========================================="
echo ""

# Configuration
API_BASE="http://localhost:8080"
ENDPOINT="/api/aps/hubs"

# Check if session cookie is provided
if [ -z "$SESSION_COOKIE" ]; then
    echo "ERROR: SESSION_COOKIE environment variable not set"
    echo "Usage: SESSION_COOKIE='dom-bim-session=abc123...' $0"
    exit 1
fi

echo "Step 1: Verify Redis is running"
echo "-------------------------------------------"
docker ps | grep dom-bim-redis
if [ $? -ne 0 ]; then
    echo "WARNING: Redis container not found running"
fi
echo ""

echo "Step 2: Stop Redis"
echo "-------------------------------------------"
docker stop dom-bim-redis
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to stop Redis container"
    exit 1
fi
echo "✓ Redis stopped"
echo ""

echo "Waiting 2 seconds for connections to time out..."
sleep 2

echo ""
echo "Step 3: Make API request (should fail closed with 503)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$ENDPOINT" \
    -H "Cookie: $SESSION_COOKIE" \
    -H "x-request-id: test-redis-down")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response body:"
echo "$BODY" | python -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# Validation
if [ "$HTTP_CODE" = "503" ]; then
    echo "✅ PASSED: Fail-closed behavior confirmed"
    echo "   Got expected 503 status"
    
    # Check if response contains expected error
    if echo "$BODY" | grep -q "APS_UPSTREAM\|APS_ERROR"; then
        echo "✅ Response contains expected error structure"
    else
        echo "⚠️  Response structure unclear"
    fi
else
    echo "❌ FAILED: Expected 503, got $HTTP_CODE"
    echo "   Fail-open behavior detected!"
fi

echo ""
echo "Step 4: Restart Redis"
echo "-------------------------------------------"
docker start dom-bim-redis
if [ $? -eq 0 ]; then
    echo "✓ Redis restarted"
else
    echo "ERROR: Failed to restart Redis"
fi

echo ""
echo "Waiting 3 seconds for Redis to be ready..."
sleep 3

echo ""
echo "Step 5: Verify service recovered"
echo "-------------------------------------------"
RESPONSE_AFTER=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$ENDPOINT" \
    -H "Cookie: $SESSION_COOKIE" \
    -H "x-request-id: test-redis-recovered")

HTTP_CODE_AFTER=$(echo "$RESPONSE_AFTER" | tail -n1)

if [ "$HTTP_CODE_AFTER" = "200" ]; then
    echo "✅ Service recovered successfully"
else
    echo "⚠️  Service returned $HTTP_CODE_AFTER (may need more time)"
fi

echo ""
echo "Check logs for:"
echo "  grep 'redis_unavailable_outbound_limit' logs/api.log"
echo "  grep 'test-redis-down' logs/api.log"
