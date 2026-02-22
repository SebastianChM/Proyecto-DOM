#!/bin/bash
# Hito 4 - Test Rate Limiting
# Verifies that webhook endpoint enforces 100 requests/min per IP

set -e

API_URL="${API_URL:-http://localhost:8080}"
SECRET="${APS_WEBHOOK_SIGNING_SECRET:-test-secret-for-ci}"

echo "========================================="
echo "Test: Rate Limiting (100 req/min per IP)"
echo "========================================="

PAYLOAD='{"hook":{"hookId":"rate-test","deliveryId":"rate-'$(date +%s)'","event":"test.rate"},"payload":{"test":"data"}}'

# Function to send request
send_request() {
    local SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
    
    curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-adsk-signature: sha1hash=$SIGNATURE" \
        -d "$PAYLOAD" \
        "$API_URL/api/webhooks/aps/data/callback"
}

# Test 1: Normal traffic (50 requests)
echo ""
echo "Test 1: Normal Traffic (50 requests)"
echo "Expected: All 202"

SUCCESS_COUNT=0
for i in {1..50}; do
    STATUS=$(send_request)
    if [ "$STATUS" = "202" ]; then
        ((SUCCESS_COUNT++))
    fi
done

echo "✅ $SUCCESS_COUNT/50 successful"

if [ $SUCCESS_COUNT -eq 50 ]; then
    echo "✅ PASS: Normal traffic allowed"
else
    echo "❌ FAIL: Some requests rejected"
    exit 1
fi

# Wait for rate limit window to reset
echo ""
echo "Waiting 65 seconds for rate limit window to reset..."
sleep 65

# Test 2: Excessive traffic (150 requests in burst)
echo ""
echo "Test 2: Excessive Traffic (150 requests)"
echo "Expected: First 100 = 202, Rest = 429"

SUCCESS_COUNT=0
RATE_LIMITED_COUNT=0

for i in {1..150}; do
    STATUS=$(send_request)
    if [ "$STATUS" = "202" ]; then
        ((SUCCESS_COUNT++))
    elif [ "$STATUS" = "429" ]; then
        ((RATE_LIMITED_COUNT++))
    fi
    
    # Print progress every 25 requests
    if [ $((i % 25)) -eq 0 ]; then
        echo "Progress: $i/150 (Success: $SUCCESS_COUNT, Rate-limited: $RATE_LIMITED_COUNT)"
    fi
done

echo ""
echo "Results:"
echo "  Successful (202): $SUCCESS_COUNT"
echo "  Rate-limited (429): $RATE_LIMITED_COUNT"

if [ $SUCCESS_COUNT -ge 90 ] && [ $SUCCESS_COUNT -le 110 ]; then
    echo "✅ PASS: Rate limit enforced (~100 req/min)"
else
    echo "❌ FAIL: Rate limit not working correctly"
    exit 1
fi

if [ $RATE_LIMITED_COUNT -ge 40 ]; then
    echo "✅ PASS: Excess requests rate-limited"
else
    echo "❌ FAIL: Not enough requests rate-limited"
    exit 1
fi

echo ""
echo "========================================="
echo "All Rate Limiting Tests Passed ✅"
echo "========================================="
