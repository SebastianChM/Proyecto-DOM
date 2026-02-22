#!/bin/bash
# Hito 3 - Test 1: Simple Repetition
# Verifies same token on repeat calls

echo "========================================="
echo "Test 1: Simple Repetition"
echo "========================================="
echo ""

API_BASE="http://localhost:8080"
ENDPOINT="/api/viewer/token"

echo "Step 1: First call (cache miss)"
echo "-------------------------------------------"
RESPONSE1=$(curl -s "$API_BASE$ENDPOINT")
TOKEN1=$(echo "$RESPONSE1" | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")

if [ -z "$TOKEN1" ]; then
  echo "❌ FAILED: No token received"
  echo "Response: $RESPONSE1"
  exit 1
fi

echo "✓ Token received: ${TOKEN1:0:20}..."
echo ""

sleep 1

echo "Step 2: Second call (should be cache hit)"
echo "-------------------------------------------"
RESPONSE2=$(curl -s "$API_BASE$ENDPOINT")
TOKEN2=$(echo "$RESPONSE2" | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")

if [ -z "$TOKEN2" ]; then
  echo "❌ FAILED: No token received"
  exit 1
fi

echo "✓ Token received: ${TOKEN2:0:20}..."
echo ""

echo "Step 3: Compare tokens"
echo "-------------------------------------------"
if [ "$TOKEN1" = "$TOKEN2" ]; then
  echo "✅ PASS: Tokens match (cache hit)"
  echo ""
  echo "Check logs for:"
  echo "  grep 'viewer_token_cache_hit' logs/api.log | tail -1"
else
  echo "❌ FAIL: Tokens different (cache miss)"
  echo "Token 1: ${TOKEN1:0:40}"
  echo "Token 2: ${TOKEN2:0:40}"
  exit 1
fi
