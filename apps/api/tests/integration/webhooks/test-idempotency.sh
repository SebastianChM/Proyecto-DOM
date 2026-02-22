#!/bin/bash
# Test Idempotency - Same webhook sent twice should not duplicate

set -e

API_URL="${API_URL:-http://localhost:8080}"
SECRET="${APS_WEBHOOK_SIGNING_SECRET:-CHANGE_ME_MUST_MATCH_APS_CONSOLE}"

echo "========================================="
echo "Test: Idempotency"
echo "========================================="

# Use same deliveryId for both requests
DELIVERY_ID="idempotent-test-$(date +%s)" 
PAYLOAD="{\"hook\":{\"hookId\":\"test-hook\",\"deliveryId\":\"${DELIVERY_ID}\",\"event\":\"test.idempotency\"},\"payload\":{\"test\":\"data\"}}"

# Calculate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

echo "Deliverray ID: $DELIVERY_ID"
echo "Payload: $PAYLOAD"
echo ""

echo "Sending first webhook..."
RESPONSE1=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-adsk-signature: sha1hash=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$API_URL/api/webhooks/aps/data/callback")

echo "Response 1: $RESPONSE1"
STATUS1=$(echo "$RESPONSE1" | jq -r '.status')
DELIVERY_ID_1=$(echo "$RESPONSE1" | jq -r '.deliveryId')

if [ "$STATUS1" != "ENQUEUED" ]; then
  echo "❌ FAIL: First request should be ENQUEUED, got $STATUS1"
  exit 1
fi

echo "✅ First webhook: $STATUS1 (deliveryId: $DELIVERY_ID_1)"
echo ""

sleep 1

echo "Sending duplicate webhook (same deliveryId)..."
RESPONSE2=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-adsk-signature: sha1hash=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$API_URL/api/webhooks/aps/data/callback")

echo "Response 2: $RESPONSE2"
STATUS2=$(echo "$RESPONSE2" | jq -r '.status')
DELIVERY_ID_2=$(echo "$RESPONSE2" | jq -r '.deliveryId')

if [ "$STATUS2" != "DUPLICATE" ]; then
  echo "❌ FAIL: Second request should be DUPLICATE, got $STATUS2"
  exit 1
fi

echo "✅ Second webhook: $STATUS2 (deliveryId: $DELIVERY_ID_2)"
echo ""

# Verify same delivery ID
if [ "$DELIVERY_ID_1" = "$DELIVERY_ID_2" ]; then
  echo "✅ PASS: Same deliveryId returned ($DELIVERY_ID_1)"
else
  echo "❌ FAIL: Different deliveryIds: $DELIVERY_ID_1 vs $DELIVERY_ID_2"
  exit 1
fi

echo ""
echo "========================================="
echo "Idempotency Test Passed ✅"
echo "========================================="
