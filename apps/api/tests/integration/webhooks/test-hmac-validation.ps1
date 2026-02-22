# Hito 4 - Test HMAC Validation (PowerShell)
# Tests HMAC signature validation for APS webhooks

param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$Secret = "test-secret-12345"
)

Write-Host "========================================="
Write-Host "Test: HMAC Validation"
Write-Host "========================================="

$payload = '{"hook":{"hookId":"test-hook","deliveryId":"test-delivery-1","event":"test.event"},"payload":{"test":"data"}}'

# Test 1: Invalid Signature
Write-Host ""
Write-Host "Test 1: Invalid Signature (Should 403)"
Write-Host "=========================================

"

$wrongSignature = "sha1hash=00000000000000000000000000000000"

try {
    $response = Invoke-WebRequest `
        -Uri "$ApiUrl/api/webhooks/aps/data/callback" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "x-adsk-signature" = $wrongSignature
        } `
        -Body $payload `
        -ErrorAction SilentlyContinue

    Write-Host "❌ FAIL: Expected 403, got $($response.StatusCode)"
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403 -or $statusCode -eq 401) {
        Write-Host "✅ PASS: Invalid signature rejected ($statusCode)"
    } else {
        Write-Host "❌ FAIL: Expected 403/401, got $statusCode"
        exit 1
    }
}

# Test 2: Missing Signature
Write-Host ""
Write-Host "Test 2: Missing Signature (Should 401)"
Write-Host "========================================"

try {
    $response = Invoke-WebRequest `
        -Uri "$ApiUrl/api/webhooks/aps/data/callback" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $payload `
        -ErrorAction SilentlyContinue

    Write-Host "❌ FAIL: Expected 401, got $($response.StatusCode)"
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "✅ PASS: Missing signature rejected (401)"
    } else {
        Write-Host "❌ FAIL: Expected 401, got $statusCode"
        exit 1
    }
}

# Test 3: Valid Signature
Write-Host ""
Write-Host "Test 3: Valid Signature (Should 202)"
Write-Host "====================================="

# Calculate HMAC-SHA256
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($Secret)
$hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payload))
$signature = "sha1hash=" + [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()

Write-Host "Payload: $payload"
Write-Host "Signature: $signature"

try {
    $response = Invoke-WebRequest `
        -Uri "$ApiUrl/api/webhooks/aps/data/callback" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "x-adsk-signature" = $signature
        } `
        -Body $payload

    if ($response.StatusCode -eq 202) {
        $body = $response.Content | ConvertFrom-Json
        Write-Host "✅ PASS: Valid signature accepted (202)"
        Write-Host "Response: deliveryId=$($body.deliveryId), status=$($body.status)"
    } else {
        Write-Host "❌ FAIL: Expected 202, got $($response.StatusCode)"
        exit 1
    }
} catch {
    Write-Host "❌ FAIL: Request failed - $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host "========================================="
Write-Host "All HMAC Tests Passed ✅"
Write-Host "========================================="
