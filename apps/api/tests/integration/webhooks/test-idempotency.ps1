# Hito 4 - Test Idempotency (PowerShell)
# Verifies duplicate webhooks are not processed twice

param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$Secret = "test-secret-12345"
)

# Override with environment variables if set
if ($env:API_URL) { $ApiUrl = $env:API_URL }
if ($env:APS_WEBHOOK_SIGNING_SECRET) { $Secret = $env:APS_WEBHOOK_SIGNING_SECRET }
Write-Host "Test: Idempotency"
Write-Host "========================================="

# Generate unique delivery ID for this test run
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$deliveryId = "idempotent-test-$timestamp"

$payload = @"
{"hook":{"hookId":"test-hook","deliveryId":"$deliveryId","event":"test.idempotency"},"payload":{"test":"data"}}
"@

Write-Host "Delivery ID: $deliveryId"
Write-Host ""

# Calculate HMAC signature
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($Secret)
$hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payload))
$signature = "sha1hash=" + [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()

# Test 1: First delivery - should be ENQUEUED
Write-Host "Test 1: First Delivery (Should ENQUEUE)"
Write-Host "========================================="

try {
    $response1 = Invoke-WebRequest `
        -Uri "$ApiUrl/api/webhooks/aps/data/callback" `
        -Method POST `
        -Headers @{
        "Content-Type"     = "application/json"
        "x-adsk-signature" = $signature
    } `
        -Body $payload

    if ($response1.StatusCode -eq 202) {
        $body1 = $response1.Content | ConvertFrom-Json
        Write-Host "✅ First request accepted (202)"
        Write-Host "Response: deliveryId=$($body1.deliveryId), status=$($body1.status)"
        
        if ($body1.status -eq "ENQUEUED") {
            Write-Host "✅ PASS: First webhook ENQUEUED"
        }
        else {
            Write-Host "❌ FAIL: Expected status=ENQUEUED, got $($body1.status)"
            exit 1
        }
        
        $firstDeliveryId = $body1.deliveryId
    }
    else {
        Write-Host "❌ FAIL: Expected 202, got $($response1.StatusCode)"
        exit 1
    }
}
catch {
    Write-Host "❌ FAIL: First request failed - $($_.Exception.Message)"
    exit 1
}

# Wait 1 second
Write-Host ""
Write-Host "Waiting 1 second before sending duplicate..."
Start-Sleep -Seconds 1

# Test 2: Duplicate delivery - should be DUPLICATE
Write-Host ""
Write-Host "Test 2: Duplicate Delivery (Should DUPLICATE)"
Write-Host "=============================================="

try {
    $response2 = Invoke-WebRequest `
        -Uri "$ApiUrl/api/webhooks/aps/data/callback" `
        -Method POST `
        -Headers @{
        "Content-Type"     = "application/json"
        "x-adsk-signature" = $signature
    } `
        -Body $payload

    if ($response2.StatusCode -eq 202) {
        $body2 = $response2.Content | ConvertFrom-Json
        Write-Host "✅ Second request accepted (202)"
        Write-Host "Response: deliveryId=$($body2.deliveryId), status=$($body2.status)"
        
        if ($body2.status -eq "DUPLICATE") {
            Write-Host "✅ PASS: Duplicate webhook detected"
        }
        else {
            Write-Host "❌ FAIL: Expected status=DUPLICATE, got $($body2.status)"
            exit 1
        }
        
        # Verify same deliveryId
        if ($body2.deliveryId -eq $firstDeliveryId) {
            Write-Host "✅ PASS: Same deliveryId returned ($firstDeliveryId)"
        }
        else {
            Write-Host "❌ FAIL: Different deliveryIds: $firstDeliveryId vs $($body2.deliveryId)"
            exit 1
        }
    }
    else {
        Write-Host "❌ FAIL: Expected 202, got $($response2.StatusCode)"
        exit 1
    }
}
catch {
    Write-Host "❌ FAIL: Second request failed - $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host "========================================="
Write-Host "All Idempotency Tests Passed ✅"
Write-Host "========================================="
