#!/bin/bash
# Test B: Rate Limiting Validation
# Verifies that rate limiter blocks excessive requests

echo "========================================="
echo "Test B: Rate Limiting Validation"
echo "========================================="
echo ""

# Configuration
API_BASE="http://localhost:8080"
ENDPOINT="/api/aps/hubs"
NUM_REQUESTS=50

# Check if session cookie is provided
if [ -z "$SESSION_COOKIE" ]; then
    echo "ERROR: SESSION_COOKIE environment variable not set"
    echo "Usage: SESSION_COOKIE='dom-bim-session=abc123...' $0"
    exit 1
fi

echo "Sending $NUM_REQUESTS parallel requests..."
echo "Expected: ~30 succeed, rest get 429"
echo ""

# Create temp file for results
RESULTS_FILE=$(mktemp)

# Send requests in parallel
for i in $(seq 1 $NUM_REQUESTS); do
    {
        RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X GET "$API_BASE$ENDPOINT" \
            -H "Cookie: $SESSION_COOKIE" \
            -H "x-request-id: test-ratelimit-$i")
        echo "$i:$RESPONSE" >> "$RESULTS_FILE"
    } &
done

wait

echo "Results:"
echo "-------------------------------------------"

# Count status codes
SUCCESS_COUNT=$(grep ":200$" "$RESULTS_FILE" | wc -l)
RATE_LIMITED_COUNT=$(grep ":429$" "$RESULTS_FILE" | wc -l)
ERROR_COUNT=$(grep -v ":200$\|:429$" "$RESULTS_FILE" | wc -l)

echo "200 OK:              $SUCCESS_COUNT"
echo "429 Rate Limited:    $RATE_LIMITED_COUNT"
echo "Other errors:        $ERROR_COUNT"
echo ""

# Validation
if [ "$RATE_LIMITED_COUNT" -gt 0 ]; then
    echo "✅ PASSED: Rate limiting is working"
    echo "   Got $RATE_LIMITED_COUNT rate limited responses"
else
    echo "❌ FAILED: No rate limiting detected"
    echo "   Expected some 429 responses"
fi

echo ""
echo "Check logs for:"
echo "  grep 'aps_outbound_blocked' logs/api.log"
echo "  grep 'Rate limit exceeded' logs/api.log"

# Cleanup
rm "$RESULTS_FILE"
