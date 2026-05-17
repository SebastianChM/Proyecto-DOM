$BASE = "http://localhost:8080"
Write-Host "=== SETUP: Generando sesion ===" 
$cookieLine = npx tsx scripts/qa-session.ts 2>&1 | Where-Object { $_ -match "^COOKIE=" }
if (-not $cookieLine) { Write-Host "ERROR: No cookie"; exit 1 }
$COOKIE = $cookieLine -replace "^COOKIE=", ""
Write-Host "Cookie OK: $($COOKIE.Substring(0,40))..."
$H = @{ "Cookie" = $COOKIE; "Content-Type" = "application/json" }
try {
    $me = Invoke-RestMethod -Uri "$BASE/api/auth/me" -Headers $H -Method GET -ErrorAction Stop
    Write-Host "Auth: $($me | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Auth FAIL: $($_.ErrorDetails.Message)"
    exit 1
}
