#!/bin/bash
# Test HMAC Validation for APS Webhooks
# Tests both invalid and valid signatures

set -e # Exit on error

API_URL="${API_URL:-http://localhost:8080}"
SECRET="${APS_WEBHOOK_SIGNING_SECRET:-CHANGE_ME_MUST_MATCH_APS_CONSOLE}"

echo "========================================="
echo "Test 1: Invalid Signature (Should 403)"
echo "========================================="

PAYLOAD='{"hook":{"hookId":"test-hook","deliveryId":"test-delivery-1","event":"test.event"},"payload":{"test":"data"}}'

# Calculate WRONG signature
WRONG_SIGNATURE="sha1hash=00000000000000000000000000000000"

echo "Payload: $PAYLOAD"
echo "Wrong Signature: $WRONG_SIGNATURE"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-adsk-signature: $WRONG_SIGNATURE" \
  -d "$PAYLOAD" \
  "$API_URL/api/webhooks/aps/data/callback")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $BODY"
echo ""

if [ "$HTTP_STATUS" = "403" ] || [ "$HTTP_STATUS" = "401" ]; then
  echo "✅ PASS: Invalid signature correctly rejected"
else
  echo "❌ FAIL: Expected 403/401, got $HTTP_STATUS"
  exit 1
fi

echo ""
echo "========================================="
echo "Test 2: Valid Signature (Should 202)"
echo "========================================="

# Calculate CORRECT signature using HMAC-SHA256
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

echo "Payload: $PAYLOAD"
echo "Valid Signature: sha1hash=$SIGNATURE"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-adsk-signature: sha1hash=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$API_URL/api/webhooks/aps/data/callback")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $BODY"
echo ""

if [ "$HTTP_STATUS" = "202" ]; then
  echo "✅ PASS: Valid signature accepted, webhook enqueued"
else
  echo "❌ FAIL: Expected 202, got $HTTP_STATUS"
  exit 1
fi

echo ""
echo "========================================="
echo "Test 3: Missing Signature (Should 401)"
echo "========================================="

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$API_URL/api/webhooks/aps/data/callback")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

echo "Response Status: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "401" ]; then
  echo "✅ PASS: Missing signature correctly rejected"
else
  echo "❌ FAIL: Expected 401, got $HTTP_STATUS"
  exit 1
fi

echo ""
echo "========================================="
echo "All HMAC Tests Passed ✅"
echo "========================================="
