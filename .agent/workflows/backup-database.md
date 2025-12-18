---
description: Database backup procedure before schema migrations
---

# Database Backup Workflow

Procedimiento estándar para respaldo de base de datos SQLite antes de ejecutar migraciones de Prisma.

## Pre-Migration Backup

### 1. Crear respaldo con timestamp

```powershell
# turbo
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
Copy-Item "prisma\dev.db" "prisma\backups\dev_$timestamp.db"
```

### 2. Verificar integridad del respaldo

```powershell
# turbo
Get-ChildItem "prisma\backups\" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

### 3. Ejecutar migración

```powershell
npx prisma migrate dev --name <nombre_descriptivo>
```

## Rollback Procedure

En caso de fallo durante la migración:

### 1. Detener servicios

Terminar procesos de API y Frontend antes de restaurar.

### 2. Restaurar respaldo

```powershell
Copy-Item "prisma\backups\dev_<TIMESTAMP>.db" "prisma\dev.db" -Force
```

### 3. Regenerar cliente Prisma

```powershell
npx prisma generate
```

### 4. Reiniciar servicios

```powershell
npm run dev
```

## Consideraciones

- Directorio de respaldos: `prisma/backups/`
- Convención de nombres: `dev_YYYYMMDD_HHMMSS.db`
- Retención recomendada: últimos 5 respaldos
- **Crítico**: No confirmar "Reset database" sin respaldo previo
