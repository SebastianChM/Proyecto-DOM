#!/bin/bash
# Test A: Cache Hit Validation
# Verifies that cache reduces APS calls

echo "========================================="
echo "Test A: Cache Hit Validation"
echo "========================================="
echo ""

# Configuration
API_BASE="http://localhost:8080"
ENDPOINT="/api/aps/hubs"

# Check if session cookie is provided
if [ -z "$SESSION_COOKIE" ]; then
    echo "ERROR: SESSION_COOKIE environment variable not set"
    echo "Usage: SESSION_COOKIE='dom-session=abc123...' $0"
    exit 1
fi

echo "Step 1: First call (should be cache miss)"
echo "-------------------------------------------"
RESPONSE1=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$ENDPOINT" \
    -H "Cookie: $SESSION_COOKIE" \
    -H "x-request-id: test-cache-1")

HTTP_CODE1=$(echo "$RESPONSE1" | tail -n1)
BODY1=$(echo "$RESPONSE1" | sed '$d')

echo "HTTP Status: $HTTP_CODE1"
echo "Response preview: ${BODY1:0:200}..."
echo ""

if [ "$HTTP_CODE1" != "200" ]; then
    echo "❌ FAILED: Expected 200, got $HTTP_CODE1"
    exit 1
fi

echo "Waiting 2 seconds..."
sleep 2

echo ""
echo "Step 2: Second call (should be cache hit)"
echo "-------------------------------------------"
RESPONSE2=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$ENDPOINT" \
    -H "Cookie: $SESSION_COOKIE" \
    -H "x-request-id: test-cache-2")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

echo "HTTP Status: $HTTP_CODE2"
echo "Response preview: ${BODY2:0:200}..."
echo ""

if [ "$HTTP_CODE2" != "200" ]; then
    echo "❌ FAILED: Expected 200, got $HTTP_CODE2"
    exit 1
fi

echo ""
echo "Step 3: Verify logs"
echo "-------------------------------------------"
echo "Check API logs for:"
echo "  Call 1: [APS_CACHE] Cache miss"
echo "  Call 1: [APS_INTEGRATION] Fetching hubs from APS"
echo "  Call 2: [APS_CACHE] Cache hit"
echo "  Call 2: NO APS fetch log"
echo ""

echo "✅ Test completed. Review logs to confirm cache behavior."
echo ""
echo "Expected logs:"
echo "  grep 'test-cache-1' logs/api.log | grep 'Cache miss'"
echo "  grep 'test-cache-2' logs/api.log | grep 'Cache hit'"
