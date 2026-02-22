---
description: Database backup procedure before schema migrations
---

# Database Backup Workflow

Procedimiento estándar para respaldo de base de datos PostgreSQL antes de ejecutar migraciones de Prisma.

## Pre-Migration Backup

### 1. Crear respaldo con pg_dump

```powershell
# turbo
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupDir = "packages\database\backups"
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir }
pg_dump -h localhost -U dom -d dom_bim -F c -f "$backupDir\backup_$timestamp.dump"
```

**Nota:** Requiere que `PGPASSWORD` esté configurado como variable de entorno o usar `.pgpass`.

### 2. Verificar integridad del respaldo

```powershell
# turbo
Get-ChildItem "packages\database\backups\" -Filter "*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | Format-Table Name, Length, LastWriteTime
```

### 3. Ejecutar migración

```powershell
cd packages\database
npx prisma migrate dev --name <nombre_descriptivo>
```

## Rollback Procedure

En caso de fallo durante la migración:

### 1. Detener servicios

```powershell
# Terminar procesos de API y Frontend antes de restaurar
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 2. Restaurar respaldo

```powershell
# Restaurar desde dump
pg_restore -h localhost -U dom -d dom_bim -c "packages\database\backups\backup_<TIMESTAMP>.dump"
```

**Alternativa: Restaurar SQL plano**

```powershell
psql -h localhost -U dom -d dom_bim -f "packages\database\backups\backup_<TIMESTAMP>.sql"
```

### 3. Regenerar cliente Prisma

```powershell
cd packages\database
npx prisma generate
```

### 4. Reiniciar servicios

```powershell
npm run dev
```

## Backup Automático con Docker

Si usas Docker, puedes usar este comando:

```bash
docker exec dom-bim-db pg_dump -U dom -d dom_bim -F c > backup_$(date +%Y%m%d_%H%M%S).dump
```

## Consideraciones

- **Directorio de respaldos:** `packages/database/backups/`
- **Convención de nombres:** `backup_YYYYMMDD_HHMMSS.dump`
- **Retención recomendada:** últimos 5 respaldos
- **Formatos soportados:**
  - `.dump` - Formato custom de PostgreSQL (recomendado)
  - `.sql` - SQL plano (más grande, pero legible)
- **⚠️ CRÍTICO:** No ejecutar `prisma migrate reset` sin respaldo previo
- **⚠️ CRÍTICO:** Verificar que no hay conexiones activas antes de restaurar

## Variables de Entorno Requeridas

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=dom
POSTGRES_DB=dom_bim
PGPASSWORD=<tu_password>  # O usar .pgpass
```
