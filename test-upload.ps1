$filepath = "c:\Users\Sebastian\Proyecto DOM\test-mock.rvt"
$projectId = "7a997146-c612-41d5-b700-136b3cdd4f7a"
$url = "http://localhost:8080/api/files/upload"

Add-Type -AssemblyName System.Net.Http

$httpClient = New-Object System.Net.Http.HttpClient
$multipartContent = New-Object System.Net.Http.MultipartFormDataContent

# Add file
$fileStream = [System.IO.File]::OpenRead($filepath)
$fileContent = New-Object System.Net.Http.StreamContent($fileStream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
$multipartContent.Add($fileContent, "file", "test-mock.rvt")

# Add projectId
$stringContent = New-Object System.Net.Http.StringContent($projectId)
$multipartContent.Add($stringContent, "projectId")

Write-Host "Uploading file to $url..." -ForegroundColor Yellow

try {
    $response = $httpClient.PostAsync($url, $multipartContent).Result
    $result = $response.Content.ReadAsStringAsync().Result
    
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor $(if ($response.IsSuccessStatusCode) { "Green" } else { "Red" })
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host $result
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    $fileStream.Close()
    $httpClient.Dispose()
}
