#!/bin/bash
# Test E: Error Type Mapping Validation
# Verifies that APS errors are correctly mapped to normalized codes

echo "========================================="
echo "Test E: Error Type Mapping Validation"
echo "========================================="
echo ""

# Configuration
API_BASE="http://localhost:8080"
ENDPOINT="/api/aps/hubs"

echo "Test E.1: Invalid Session (401 → APS_REFRESH_REQUIRED)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$ENDPOINT" \
    -H "Cookie: dom-session=invalid-session-cookie" \
    -H "x-request-id: test-error-401")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | python -m json.tool 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "401" ]; then
    if echo "$BODY" | grep -q "APS_REFRESH_REQUIRED\|APS_UNAUTHORIZED"; then
        echo "✅ PASSED: 401 correctly mapped"
    else
        echo "⚠️  Status 401 but unexpected error code"
    fi
else
    echo "❌ Expected 401, got $HTTP_CODE"
fi

echo ""
echo "-------------------------------------------"
echo ""

# Check response structure
echo "Verify response structure:"
echo ""
CHECK_ERROR=$(echo "$BODY" | grep -o '"error"' | wc -l)
CHECK_CODE=$(echo "$BODY" | grep -o '"code"' | wc -l)
CHECK_MESSAGE=$(echo "$BODY" | grep -o '"message"' | wc -l)
CHECK_REQUESTID=$(echo "$BODY" | grep -o '"requestId"' | wc -l)
CHECK_STATUS=$(echo "$BODY" | grep -o '"status"' | wc -l)

echo "Response has 'error' field:     $([ $CHECK_ERROR -gt 0 ] && echo '✅ Yes' || echo '❌ No')"
echo "Response has 'code' field:      $([ $CHECK_CODE -gt 0 ] && echo '✅ Yes' || echo '❌ No')"
echo "Response has 'message' field:   $([ $CHECK_MESSAGE -gt 0 ] && echo '✅ Yes' || echo '❌ No')"
echo "Response has 'requestId' field: $([ $CHECK_REQUESTID -gt 0 ] && echo '✅ Yes' || echo '❌ No')"
echo "Response has 'status' field:    $([ $CHECK_STATUS -gt 0 ] && echo '✅ Yes' || echo '❌ No')"

echo ""
echo "Expected format:"
echo '{'
echo '  "error": "APS_ERROR",'
echo '  "code": "APS_REFRESH_REQUIRED",'
echo '  "message": "...",'
echo '  "requestId": "test-error-401",'
echo '  "status": 401'
echo '}'

echo ""
echo "-------------------------------------------"
echo "Additional Error Codes to Test Manually:"
echo ""
echo "APS_FORBIDDEN (403):     Requires invalid permissions"
echo "APS_NOT_FOUND (404):     Requires invalid resource ID"
echo "APS_RATE_LIMITED (429):  Run test-b-rate-limit.sh"
echo "APS_UPSTREAM (503):      Run test-c-redis-down.sh"
