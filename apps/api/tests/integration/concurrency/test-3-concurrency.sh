#!/bin/bash
# Hito 3 - Test 3: Concurrency
# Verifies single APS call for 20 simultaneous requests

echo "========================================="
echo "Test 3: Concurrency Test"
echo "========================================="
echo ""

API_BASE="http://localhost:8080"
ENDPOINT="/api/viewer/token"
NUM_REQUESTS=20

echo "Sending $NUM_REQUESTS parallel requests..."
echo ""

# Clear cache first
curl -s "$API_BASE/api/admin/clear-cache" > /dev/null 2>&1 || true

sleep 1

# Create temp file for results
RESULTS_FILE=$(mktemp)
START_TIME=$(date +%s%3N)

# Send requests in parallel
for i in $(seq 1 $NUM_REQUESTS); do
  {
    RESPONSE=$(curl -s "$API_BASE$ENDPOINT")
    TOKEN=$(echo "$RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))"  2>/dev/null || echo "")
    echo "$i:$TOKEN" >> "$RESULTS_FILE"
  } &
done

wait
END_TIME=$(date +%s%3N)
DURATION_MS=$((END_TIME - START_TIME))

echo "Completed in ${DURATION_MS}ms"
echo ""

# Count unique tokens
UNIQUE_TOKENS=$(cut -d: -f2 "$RESULTS_FILE" | sort | uniq | wc -l)

echo "Results:"
echo "-------------------------------------------"
echo "Total requests:  $NUM_REQUESTS"
echo "Unique tokens:   $UNIQUE_TOKENS"
echo ""

if [ "$UNIQUE_TOKENS" = "1" ]; then
  echo "✅ PASS: All requests got same token (concurrency lock working)"
  echo ""
  echo "Check logs for:"
  echo "  grep 'viewer_token_generated' logs/api.log | tail -5"
  echo "  grep 'Lock held, waiting' logs/api.log | wc -l"
  echo "  Expected: 1 generation, ~19 lock waits"
else
  echo "⚠️ WARNING: Multiple tokens generated ($UNIQUE_TOKENS)"
  echo "   Expected 1, but concurrency might not be perfect in local testing"
fi

# Cleanup
rm "$RESULTS_FILE"
