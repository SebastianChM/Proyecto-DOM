New-NetFirewallRule -DisplayName "DOM Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "DOM Backend" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
Write-Host "Reglas de Firewall creadas exitosamente para puertos 3000 y 8080"
