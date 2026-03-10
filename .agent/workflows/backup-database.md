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

- **Directorio de respaldos:** `storage/backups/`
- **Convención de nombres:** `<dbname>_YYYY-MM-DD_HH-MM-SS.dump`
- **Retención recomendada:** últimos 5 respaldos
- **Formatos soportados:**
  - `.dump` - Formato custom de PostgreSQL (recomendado, `--format=custom`)
  - `.sql` - SQL plano (`--format=sql`, más grande, pero legible)
- **⚠️ CRÍTICO:** No ejecutar `prisma migrate reset` sin respaldo previo
- **⚠️ CRÍTICO:** Verificar que no hay conexiones activas antes de restaurar

## Variables de Entorno Requeridas

El script lee `DATABASE_URL` del entorno o de `apps/api/.env` automáticamente. No requiere configuración adicional.
