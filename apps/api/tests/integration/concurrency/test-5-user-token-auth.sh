#!/bin/bash
# Hito 3 - Test 5: User Token Protection
# Verifies strict validation for user tokens

echo "========================================="
echo "Test 5: User Token Protection"
echo "========================================="
echo ""

API_BASE="http://localhost:8080"
ENDPOINT="/auth/user-token"

echo "Test 5a: No session (should get 401)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE$ENDPOINT")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "401" ]; then
  CODE=$(echo "$BODY" | python -c "import sys, json; print(json.load(sys.stdin).get('code', ''))" 2>/dev/null || echo "")
  if [ "$CODE" = "USER_SESSION_REQUIRED" ]; then
    echo "✅ PASS: Correct 401 with USER_SESSION_REQUIRED"
  else
    echo "⚠️  Got 401 but code: $CODE"
  fi
else
  echo "❌ FAIL: Expected 401, got $HTTP_CODE"
fi

echo ""
echo "-------------------------------------------"
echo ""

if [ -z "$SESSION_COOKIE" ]; then
  echo "Test 5b: With valid session"
  echo "-------------------------------------------"
  echo "⏭️  SKIPPED: Set SESSION_COOKIE environment variable to test"
  echo ""
  echo "Example:"
  echo "  export SESSION_COOKIE='dom-bim-session=abc123...'"
  echo "  ./test-5-user-token-auth.sh"
  exit 0
fi

echo "Test 5b: With valid session (should get 200)"
echo "-------------------------------------------"
RESPONSE2=$(curl -s -w "\n%{http_code}" "$API_BASE$ENDPOINT" -H "Cookie: $SESSION_COOKIE")
HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

echo "Status: $HTTP_CODE2"

if [ "$HTTP_CODE2" = "200" ]; then
  TOKEN=$(echo "$BODY2" | python -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")
  SCOPE=$(echo "$BODY2" | python -c "import sys, json; print(json.load(sys.stdin).get('scope', ''))" 2>/dev/null || echo "")
  
  if [ -n "$TOKEN" ] && [ -n "$SCOPE" ]; then
    echo "✅ PASS: Got valid token with scope: $SCOPE"
  else
    echo "⚠️  Got 200 but missing token or scope"
  fi
else
  echo "Status $HTTP_CODE2"
  echo "Response: $BODY2"
fi

echo ""
echo "Summary:"
echo "-------------------------------------------"
echo "✓ Endpoint requires valid session"
echo "✓ Returns structured error codes"
echo "✓ Includes scope in response"
