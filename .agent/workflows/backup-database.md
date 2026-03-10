---
description: Database backup procedure before schema migrations
---

# Database Backup Workflow

Procedimiento estándar para respaldo de base de datos PostgreSQL antes de ejecutar migraciones de Prisma.

Backups se guardan en `storage/backups/`. Ver guía completa en `docs/deploy/BACKUPS.md`.

## Pre-Migration Backup

### 1. Crear respaldo

```bash
# Desde la raíz del proyecto
node tools/scripts/backup-db.js
```

El script auto-detecta `pg_dump` local o Docker (`dom-bim-db`).
Genera un archivo `.dump` en `storage/backups/`.

### 2. Verificar integridad

```bash
ls -lh storage/backups/*.dump | tail -5
```

### 3. Ejecutar migración

```bash
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

## Rollback Procedure

En caso de fallo durante la migración:

### 1. Restaurar respaldo

```bash
node tools/scripts/restore-db.js storage/backups/<backup-file>
```

El script pide confirmación interactiva. En producción requiere `--i-know-what-i-am-doing`.

### 2. Regenerar cliente Prisma

```bash
npx prisma generate --schema packages/database/prisma/schema.prisma
```

### 3. Reiniciar servicios

```bash
npm run dev
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
