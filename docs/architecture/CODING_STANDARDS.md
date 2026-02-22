# Estándares de Código - DOM BIM Platform

Este documento define los estándares de código para el proyecto DOM BIM Platform.
**Todos los desarrolladores (humanos e IA) deben seguir estas reglas.**

## 1. Configuración y Variables de Entorno

### ❌ NO HACER

```typescript
// INCORRECTO - hardcoding
const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
const redisHost = process.env.REDIS_HOST || "localhost";
const timeout = 60 * 1000;
```

### ✅ CORRECTO

```typescript
// CORRECTO - usar CONSTANTS
import { CONSTANTS } from "../config/constants";

const frontendUrl = CONSTANTS.FRONTEND.DEFAULT_URL;
const redisHost = CONSTANTS.REDIS.DEFAULT_HOST;
const timeout = CONSTANTS.RATE_LIMIT.USER_TOKEN_WINDOW_MS;
```

### Reglas

1. **Nunca usar `process.env` directamente** excepto en `config/env.ts`
2. **Usar `env` importado** para variables de entorno validadas
3. **Usar `CONSTANTS`** para valores por defecto y números mágicos
4. **Agregar nuevas constantes** a `constants.ts` antes de usarlas

---

## 2. Límites de Tamaño de Archivos

| Tipo                       | Límite     | Acción                           |
| -------------------------- | ---------- | -------------------------------- |
| Rutas (routes/\*.ts)       | 400 líneas | Descomponer en sub-routers       |
| Servicios (services/\*.ts) | 500 líneas | Extraer a módulos especializados |
| Componentes React          | 300 líneas | Extraer sub-componentes          |

---

## 3. Estructura de Rutas

### Estructura Preferida (Modular)

```
routes/
├── files/
│   ├── index.ts         # Router principal
│   ├── utils.ts         # Tipos y helpers compartidos
│   ├── upload.routes.ts # Endpoints de upload
│   ├── download.routes.ts
│   └── sync.routes.ts
├── auth.ts              # Archivo simple < 400 líneas
└── projects.ts
```

### Patrón de Router Modular

```typescript
// routes/feature/index.ts
import { Router } from "express";
import uploadRoutes from "./upload.routes";
import crudRoutes from "./crud.routes";

const router = Router();
router.use(uploadRoutes);
router.use(crudRoutes);

export default router;
```

---

## 4. Manejo de Errores

### Patrón Estándar

```typescript
try {
  // ... logic
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error("Descriptive error context:", errorMessage);
  res.status(500).json({
    error: "User-friendly message",
    details: errorMessage,
  });
}
```

---

## 5. Logging

### Usar CONSTANTS.LOGGING para Truncado

```typescript
// CORRECTO
console.log(`URN: ${urn.substring(0, CONSTANTS.LOGGING.TRUNCATE_SHORT)}...`);

// INCORRECTO
console.log(`URN: ${urn.substring(0, 30)}...`);
```

---

## 6. Imports

### Orden de Imports

```typescript
// 1. Node built-ins
import fs from "fs";
import path from "path";

// 2. External packages
import { Router } from "express";
import prisma from "prisma";

// 3. Internal modules (config first)
import { env } from "../config/env";
import { CONSTANTS } from "../config/constants";

// 4. Services and utils
import { fileService } from "../services/files.service";
import { cacheService } from "../lib/redis";

// 5. Types (at the end)
import type { RequestWithSession } from "./types";
```

---

## 7. Checklist Pre-Commit

Antes de hacer commit, verificar:

- [ ] No hay `process.env` fuera de `config/env.ts`
- [ ] No hay números mágicos (usar CONSTANTS)
- [ ] No hay URLs hardcodeadas
- [ ] Archivos < 500 líneas
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa

---

## 8. Constantes Disponibles

Ver `apps/api/src/config/constants.ts` para la lista completa:

- `CONSTANTS.FRONTEND.*` - URLs y paths del frontend
- `CONSTANTS.SESSION.*` - Configuración de sesión
- `CONSTANTS.RATE_LIMIT.*` - Rate limiting
- `CONSTANTS.LOGGING.*` - Truncado de logs
- `CONSTANTS.REDIS.*` - Configuración Redis
- `CONSTANTS.APS.*` - Autodesk Platform Services
- `CONSTANTS.UPLOAD.*` - Configuración de uploads
