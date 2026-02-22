#!/bin/bash
# Test Latency - Webhook must respond in < 5 seconds

set -e

API_URL="${API_URL:-http://localhost:8080}"
SECRET="${APS_WEBHOOK_SIGNING_SECRET:-CHANGE_ME_MUST_MATCH_APS_CONSOLE}"

echo "========================================="
echo "Test: Latency < 5 seconds"
echo "========================================="

PAYLOAD='{"hook":{"hookId":"latency-test","deliveryId":"lat-1","event":"test.latency"},"payload":{"test":"data"}}'

# Calculate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

echo "Sending webhook..."
START_TIME=$(date +%s.%N)

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-adsk-signature: sha1hash=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$API_URL/api/webhooks/aps/data/callback")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
TIME_TOTAL=$(echo "$RESPONSE" | grep "TIME_TOTAL" | cut -d: -f2)

echo "Response Status: $HTTP_STATUS"
echo "Total Time: ${TIME_TOTAL}s"
echo ""

# Check status
if [ "$HTTP_STATUS" != "202" ]; then
  echo "❌ FAIL: Expected 202, got $HTTP_STATUS"
  exit 1
fi

# Check latency (must be < 5 seconds)
if [ $(echo "$TIME_TOTAL < 5.0" | bc) -eq 1 ]; then
  echo "✅ PASS: Response time ${TIME_TOTAL}s < 5s"
else
  echo "❌ FAIL: Response time ${TIME_TOTAL}s >= 5s"
  exit 1
fi

echo ""
echo "========================================="
echo "Latency Test Passed ✅"
echo "========================================="
