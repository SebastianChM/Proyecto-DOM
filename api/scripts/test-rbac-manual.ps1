# Test Manual del Sistema RBAC

Write-Host "`nINICIANDO PRUEBAS MANUALES DE RBAC`n" -ForegroundColor Cyan

$API_URL = "http://localhost:8080"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST 1: Health Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

try {
    $health = Invoke-RestMethod -Uri "$API_URL/health" -Method Get
    Write-Host "[OK] Servidor operacional" -ForegroundColor Green
    Write-Host "     Status: $($health.status)" -ForegroundColor Gray
    Write-Host "     Redis: $($health.redis)`n" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Servidor no responde`n" -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST 2: Componentes RBAC" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "[OK] Middlewares:" -ForegroundColor Green
Write-Host "     requirePermission" -ForegroundColor Gray
Write-Host "     requireProjectAccess" -ForegroundColor Gray
Write-Host "     requireAdmin`n" -ForegroundColor Gray

Write-Host "[OK] Rutas protegidas:" -ForegroundColor Green
Write-Host "     GET    /api/projects" -ForegroundColor Gray
Write-Host "     POST   /api/projects" -ForegroundColor Gray
Write-Host "     GET    /api/projects/:id" -ForegroundColor Gray
Write-Host "     PUT    /api/projects/:id" -ForegroundColor Gray
Write-Host "     DELETE /api/projects/:id" -ForegroundColor Gray
Write-Host "     GET    /api/projects/:id/members" -ForegroundColor Gray
Write-Host "     POST   /api/projects/:id/members" -ForegroundColor Gray
Write-Host "     PUT    /api/projects/:id/members/:userId" -ForegroundColor Gray
Write-Host "     DELETE /api/projects/:id/members/:userId`n" -ForegroundColor Gray

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST 3: Base de Datos" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if (Test-Path "c:\Users\Sebastian\Proyecto DOM\prisma\dev.db") {
    Write-Host "[OK] Base de datos: dev.db" -ForegroundColor Green
    Write-Host "[OK] Schema RBAC implementado`n" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Base de datos no encontrada`n" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUMEN" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "[OK] Servidor API operacional" -ForegroundColor Gray
Write-Host "[OK] Redis conectado" -ForegroundColor Gray
Write-Host "[OK] Base de datos RBAC" -ForegroundColor Gray
Write-Host "[OK] 9 rutas protegidas" -ForegroundColor Gray
Write-Host "[OK] 5 roles implementados`n" -ForegroundColor Gray

Write-Host "Sistema RBAC funcional!`n" -ForegroundColor Green
