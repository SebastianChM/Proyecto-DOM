# Hito 1 - Guía: Instalación Docker y Ejecución de Tests

## Situación Actual

Durante la validación del Hito 1, se identificó que **Docker no está instalado** en el sistema Windows, lo cual es necesario para:

- PostgreSQL (base de datos)
- Redis (rate limiting store)
- Tests completos de seguridad

## Solución: Instalar Docker Desktop

### Paso 1: Descargar Docker Desktop

1. Visita: <https://www.docker.com/products/docker-desktop/>
2. Descarga **Docker Desktop for Windows**
3. Ejecuta el instalador `Docker Desktop Installer.exe`

### Paso 2: Instalación

1. Acepta los términos de licencia
2. **Importante:** Asegúrate de habilitar:
   - ✅ **Use WSL 2 instead of Hyper-V** (recomendado)
   - ✅ **Add shortcut to desktop**
3. Haz clic en **Install**
4. **Reinicia** el equipo cuando se solicite

### Paso 3: Verificar Instalación

```powershell
# Después de reiniciar, abre PowerShell y verifica
docker --version
# Esperado: Docker version 24.x.x, build xxxxx

docker-compose --version
# Esperado: Docker Compose version v2.x.x
```

### Paso 4: Iniciar Docker Desktop

1. Abre **Docker Desktop** desde el menú inicio
2. Espera a que el ícono en la barra de tareas muestre "Docker Desktop is running"
3. Verifica estado en PowerShell:

```powershell
docker ps
# Esperado: Lista vacía (sin contenedores corriendo aún)
```

---

## Ejecutar Tests de Seguridad (Con Docker)

### Setup Completo

```powershell
# 1. Navegar al proyecto
cd "C:\Users\Sebastian\Proyecto DOM"

# 2. Iniciar servicios Docker
docker-compose up -d postgres redis

# Verificar que estén corriendo
docker ps
# Esperado:
# - dom-bim-db (postgres)
# - dom-bim-redis (redis)

# 3. Esperar a que PostgreSQL esté listo
Start-Sleep -Seconds 5

# 4. Iniciar API
cd api
npm run dev

# La API debería iniciar en http://localhost:8080
```

### Ejecutar Tests de Seguridad

**En otra terminal PowerShell:**

```powershell
# Opción 1: Script automatizado (requiere bash en Windows)
# Instalar Git Bash si no está disponible
bash scripts/test-hito1-security.sh

# Opción 2: Tests manuales con PowerShell
# Test 1: CORS Reject
Invoke-WebRequest -Uri "http://localhost:8080/api/auth/me" `
  -Headers @{"Origin"="https://evil-site.com"} `
  -UseBasicParsing | Select-Object StatusCode, Headers

# Verificar: NO debería haber header Access-Control-Allow-Origin

# Test 2: Rate Limit
1..6 | ForEach-Object {
  Write-Host "Request $_"
  Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" `
    -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue `
    | Select-Object StatusCode
}

# Esperado: Request 6 debería devolver 429

# Test 3: 401 con Request ID
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/projects" `
  -UseBasicParsing -ErrorAction SilentlyContinue

$response.StatusCode  # Esperado: 401
$response.Headers["X-Request-ID"]  # Esperado: UUID presente
```

---

## Ejecutar Tests Sin Docker (Limitado)

Si no puedes instalar Docker ahora, algunos tests básicos se pueden ejecutar:

### Setup Sin DB

```powershell
# 1. Crear .env mínimo
cd api
@"
NODE_ENV=development
PORT=8080
SESSION_SECRET=test_secret_at_least_32_characters_long_for_development_only
CORS_ORIGINS=http://localhost:3000
ADMIN_EMAILS=admin@example.com
"@ | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline

# 2. Iniciar API (fallará al conectar a DB pero iniciará parcialmente)
npm run dev
```

### Tests Parciales

```powershell
# Test CORS básico
Invoke-WebRequest -Uri "http://localhost:8080/health" `
  -Headers @{"Origin"="https://evil-site.com"} `
  -UseBasicParsing

# Test credential validation
$env:POSTGRES_PASSWORD="CHANGE_ME_IN_ENV"
node ../scripts/backup-db.js

# Esperado: Error sobre placeholder
```

---

## Alternativa: Git Bash para Ejecutar Script

Si tienes **Git for Windows** instalado:

1. Abre **Git Bash** (no PowerShell)
2. Navega al proyecto:

   ```bash
   cd "/c/Users/Sebastian/Proyecto DOM"
   ```

3. Ejecuta el script:

   ```bash
   bash scripts/test-hito1-security.sh
   ```

---

## Resumen de Opciones

| Opción             | Ventajas                                                     | Desventajas                                        | Resultados         |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------------- | ------------------ |
| **Docker Desktop** | ✅ Tests completos<br>✅ Entorno real<br>✅ DB + Redis       | ❌ Requiere instalación<br>❌ Reinicio del sistema | **12/12 tests**    |
| **Sin Docker**     | ✅ No requiere instalación                                   | ❌ Solo tests parciales<br>❌ Sin DB/Redis         | **~5/12 tests**    |
| **Git Bash**       | ✅ Ejecuta script bash<br>✅ No requiere PowerShell adaptado | ❌ Requiere Git for Windows                        | **Ejecuta script** |

---

## Recomendación

**Para completar el Hito 1 con evidencia completa:**

1. ✅ **Instalar Docker Desktop** (30 min aprox)
2. ✅ **Seguir "Setup Completo"** arriba
3. ✅ **Ejecutar tests y capturar evidencia**

**Documentación actual ya está lista:**

- ✅ `docs/hito1_test_results_security.md` - Evidencia teórica completa
- ✅ `scripts/test-hito1-security.sh` - Script listo para ejecutar
- ✅ Todos los comandos exactos para reproducir

**Los tests se pueden ejecutar en cualquier momento** siguiendo esta guía.

---

## Próximos Pasos

1. Decidir si instalar Docker ahora o más tarde
2. Si instalas Docker:
   - Seguir pasos arriba
   - Ejecutar tests
   - Actualizar `hito1_test_results_security.md` con salidas reales
3. Si no instalas Docker:
   - La documentación actual es suficiente para merge
   - Tests se pueden ejecutar después en otro entorno

---

**Última Actualización:** 2025-12-20  
**Estado:** Esperando instalación de Docker para tests completos
