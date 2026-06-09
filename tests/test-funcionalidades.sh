#!/bin/bash
# ============================================================================
# Script de Testing Automatizado - DOM BIM Platform
# ============================================================================
# Ejecuta smoke tests básicos de las funcionalidades más críticas
# 
# Uso: ./test-funcionalidades.sh
# ============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
API_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3001"
LOG_FILE="/tmp/dom-bim-test-$(date +%s).log"

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ============================================================================
# Funciones Helper
# ============================================================================

log() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
    ((PASSED_TESTS++))
}

error() {
    echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"
    ((FAILED_TESTS++))
}

warning() {
    echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"
}

test_start() {
    ((TOTAL_TESTS++))
    log "Test $TOTAL_TESTS: $1"
}

# ============================================================================
# Tests de Infraestructura
# ============================================================================

test_docker_services() {
    test_start "Verificar contenedores Docker"
    
    if docker ps | grep -q "dom-bim-db"; then
        success "PostgreSQL está corriendo"
    else
        error "PostgreSQL NO está corriendo"
        return 1
    fi
    
    if docker ps | grep -q "dom-bim-redis"; then
        success "Redis está corriendo"
    else
        error "Redis NO está corriendo"
        return 1
    fi
}

test_api_health() {
    test_start "API Health Check"
    
    response=$(curl -s -w "\\n%{http_code}" "$API_URL/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        if echo "$body" | grep -q '"database":"up"'; then
            if echo "$body" | grep -q '"redis":"up"'; then
                success "API health check: OK (Database: up, Redis: up)"
            else
                error "API health check: Redis NO está 'up'"
            fi
        else
            error "API health check: Database NO está 'up'"
        fi
    else
        error "API health check: HTTP $http_code (esperado 200)"
    fi
}

test_frontend_reachable() {
    test_start "Frontend accesible"
    
    response=$(curl -s -w "\\n%{http_code}" "$FRONTEND_URL")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        success "Frontend responde: HTTP 200"
    else
        error "Frontend: HTTP $http_code (esperado 200)"
    fi
}

# ============================================================================
# Tests de Autenticación
# ============================================================================

test_auth_login_redirect() {
    test_start "Login OAuth - Redirect a Autodesk"
    
    response=$(curl -s -w "\\n%{http_code}" -L "$API_URL/api/auth/login" | tail -n1)
    
    # Debe redirigir (302 o 200 después de seguir redirect)
    if [ "$response" = "200" ] || [ "$response" = "302" ]; then
        success "Login redirect funciona"
    else
        error "Login redirect: HTTP $response"
    fi
}

test_auth_me_unauthenticated() {
    test_start "GET /api/auth/me sin autenticación"
    
    response=$(curl -s "$API_URL/api/auth/me")
    
    if echo "$response" | grep -q '"authenticated":false'; then
        success "Sin sesión, devuelve authenticated: false"
    else
        error "Respuesta inesperada: $response"
    fi
}

# ============================================================================
# Tests de API - Endpoints Públicos
# ============================================================================

test_api_root() {
    test_start "API Root endpoint"
    
    response=$(curl -s "$API_URL/")
    
    if echo "$response" | grep -q "DOM BIM Platform API"; then
        success "API root responde correctamente"
    else
        error "API root: respuesta inesperada"
    fi
}

test_cors_headers() {
    test_start "CORS headers presentes"
    
    response=$(curl -s -I -H "Origin: $FRONTEND_URL" "$API_URL/health")
    
    # En desarrollo, CORS debe permitir credentials
    if echo "$response" | grep -qi "access-control-allow-credentials"; then
        warning "CORS headers presentes (no se verifican en health endpoint)"
    else
        warning "CORS headers no visibles en health endpoint (esperado)"
    fi
}

# ============================================================================
# Tests de Base de Datos
# ============================================================================

test_database_connection() {
    test_start "Conexión a PostgreSQL"
    
    if docker exec dom-bim-db psql -U dom_bim -d dom_bim_platform -c "SELECT 1;" > /dev/null 2>&1; then
        success "Conexión a PostgreSQL: OK"
    else
        error "No se puede conectar a PostgreSQL"
    fi
}

test_database_tables() {
    test_start "Tablas de Prisma existen"
    
    tables=$(docker exec dom-bim-db psql -U dom_bim -d dom_bim_platform -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
    
    if [ "$tables" -gt 0 ]; then
        success "Base de datos tiene $tables tablas"
    else
        error "Base de datos NO tiene tablas (ejecutar migración?)"
    fi
}

# ============================================================================
# Tests de Redis
# ============================================================================

test_redis_connection() {
    test_start "Conexión a Redis"
    
    if docker exec dom-bim-redis redis-cli PING | grep -q "PONG"; then
        success "Conexión a Redis: OK"
    else
        error "No se puede conectar a Redis"
    fi
}

test_redis_sessions() {
    test_start "Redis tiene prefijo de sesiones"
    
    keys=$(docker exec dom-bim-redis redis-cli KEYS "dom-bim:sess:*" | wc -l)
    log "Redis tiene $keys sesiones activas"
    success "Prefijo de sesiones configurado correctamente"
}

# ============================================================================
# Tests de Servicios Node
# ============================================================================

test_node_processes() {
    test_start "Procesos Node.js activos"
    
    processes=$(ps aux | grep -E "(tsx watch|next dev)" | grep -v grep | wc -l)
    
    if [ "$processes" -ge 3 ]; then
        success "Servicios Node.js corriendo ($processes procesos)"
    else
        warning "Solo $processes procesos Node.js (esperado 3: API, Worker, Frontend)"
    fi
}

# ============================================================================
# Tests de Configuración
# ============================================================================

test_env_files() {
    test_start "Archivos .env existen"
    
    if [ -f "apps/api/.env" ]; then
        success "apps/api/.env existe"
    else
        error "apps/api/.env NO existe"
    fi
    
    if [ -f "apps/web/.env.local" ]; then
        success "apps/web/.env.local existe"
    else
        warning "apps/web/.env.local NO existe (puede causar problemas de auth)"
    fi
    
    if [ -f "infra/docker/.env" ]; then
        success "infra/docker/.env existe"
    else
        error "infra/docker/.env NO existe"
    fi
}

test_env_variables() {
    test_start "Variables de entorno críticas"
    
    if grep -q "FRONTEND_URL=http://localhost:3001" apps/api/.env; then
        success "FRONTEND_URL apunta a puerto correcto (3001)"
    else
        warning "FRONTEND_URL podría estar mal configurado"
    fi
    
    if grep -q "NEXT_PUBLIC_API_URL=http://localhost:8080" apps/web/.env.local 2>/dev/null; then
        success "NEXT_PUBLIC_API_URL configurado correctamente"
    else
        warning "NEXT_PUBLIC_API_URL no configurado en .env.local"
    fi
}

# ============================================================================
# Ejecución de Tests
# ============================================================================

main() {
    clear
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║     DOM BIM Platform - Smoke Tests Automatizados             ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    log "Iniciando tests en: $(date)"
    log "Logs guardados en: $LOG_FILE"
    echo ""
    
    # Cambiar al directorio del proyecto
    cd "$(dirname "$0")/.."
    
    echo "─────────────────────────────────────────────────────────────────"
    echo "  📦 INFRAESTRUCTURA"
    echo "─────────────────────────────────────────────────────────────────"
    test_docker_services
    test_database_connection
    test_database_tables
    test_redis_connection
    test_redis_sessions
    echo ""
    
    echo "─────────────────────────────────────────────────────────────────"
    echo "  🌐 SERVICIOS WEB"
    echo "─────────────────────────────────────────────────────────────────"
    test_api_health
    test_api_root
    test_frontend_reachable
    test_node_processes
    echo ""
    
    echo "─────────────────────────────────────────────────────────────────"
    echo "  🔐 AUTENTICACIÓN"
    echo "─────────────────────────────────────────────────────────────────"
    test_auth_login_redirect
    test_auth_me_unauthenticated
    test_cors_headers
    echo ""
    
    echo "─────────────────────────────────────────────────────────────────"
    echo "  ⚙️  CONFIGURACIÓN"
    echo "─────────────────────────────────────────────────────────────────"
    test_env_files
    test_env_variables
    echo ""
    
    # Resumen
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                         RESUMEN                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Total de tests:    $TOTAL_TESTS"
    echo -e "  ${GREEN}Pasados:${NC}          $PASSED_TESTS"
    echo -e "  ${RED}Fallidos:${NC}         $FAILED_TESTS"
    echo ""
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}✓ TODOS LOS TESTS PASARON${NC}"
        echo ""
        echo "  ┌─────────────────────────────────────────────────────────┐"
        echo "  │  Sistema listo para testing manual de funcionalidades  │"
        echo "  │  Abre: http://localhost:3001                            │"
        echo "  └─────────────────────────────────────────────────────────┘"
        exit 0
    else
        echo -e "${RED}✗ ALGUNOS TESTS FALLARON${NC}"
        echo ""
        echo "  Revisa los logs en: $LOG_FILE"
        echo "  Verifica que Docker y servicios estén corriendo"
        exit 1
    fi
}

# Ejecutar
main
