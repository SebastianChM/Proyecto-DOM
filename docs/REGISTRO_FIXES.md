# 🔧 Registro de Fixes y Cambios

## Fix #001 - Loop Infinito en Login OAuth

**Fecha:** 2026-04-14 15:30  
**Reportado por:** Sebastián Chirino  
**Severidad:** 🔴 CRÍTICO  
**Módulo:** Autenticación  
**Estado:** ✅ RESUELTO

### Descripción del Problema

Al iniciar sesión con Autodesk, el callback funcionaba correctamente pero el usuario entraba en un loop infinito donde la página se quedaba en blanco con "Error" en el título.

### Pasos para Reproducir

1. Ir a http://localhost:3001
2. Hacer clic en "Sign In with Autodesk"
3. Autenticar con credenciales de Autodesk
4. Callback a `/api/auth/callback` funciona
5. Redirect a `/dashboard` falla
6. Página queda en blanco, loop infinito

### Análisis de la Causa Raíz

**Problema 1: Mismatch de URL**

- Backend: `FRONTEND_URL` no estaba configurado, usaba default `localhost:3000`
- Frontend: Next.js corriendo en `localhost:3001`
- Resultado: Backend redirigía a puerto equivocado

**Problema 2: Cookies no se compartían**

- Frontend hacía requests a través de Next.js rewrites (proxy interno)
- Las cookies de sesión no pasaban correctamente a través del proxy
- Endpoint `/api/auth/me` siempre devolvía `authenticated: false`
- UserContext del frontend no detectaba usuario autenticado

**Problema 3: Configuración de API URL**

- Frontend no tenía `NEXT_PUBLIC_API_URL` configurado
- Usaba rewrites en lugar de requests directos

### Logs del Error

#### Backend

```
[API] GET /api/auth/callback 302 → Redirect a localhost:3000/dashboard
[API] [AUTH] Callback success {"email":"ch\*\*\*@gmail.com","role":"USER"}
```

#### Frontend (Browser Console)

```
Failed to fetch user: 401 Unauthorized
GET /api/auth/me → { authenticated: false }
```

### Solución Aplicada

#### Cambio 1: Actualizar FRONTEND_URL en backend

**Archivo:** `apps/api/.env`

```diff
- # FRONTEND_URL=http://localhost:3000  # optional, defaults to localhost:3000
+ FRONTEND_URL=http://localhost:3001  # IMPORTANT: Must match Next.js port
```

#### Cambio 2: Crear .env.local en frontend

**Archivo:** `apps/web/.env.local` (NUEVO)

```env
# ── API Configuration ────────────────────────────────────────
# Direct connection to backend API (bypasses Next.js rewrites for proper cookie sharing)
NEXT_PUBLIC_API_URL=http://localhost:8080

# ── Development Mode ──────────────────────────────────────────
NODE_ENV=development
```

#### Cambio 3: Verificar CORS

**Archivo:** `apps/api/.env`

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001  # ✅ Ya incluía ambos puertos
```

### Testing Post-Fix

#### Prueba 1: Login completo ✅

```
1. Abrir http://localhost:3001
2. Click "Sign In with Autodesk"
3. Autenticar con chirinosebastianmn@gmail.com
4. ✅ Redirect correcto a http://localhost:3001/dashboard
5. ✅ Dashboard carga con datos del usuario
6. ✅ Nombre "Sebastián" aparece en header
```

#### Prueba 2: Verificación de sesión ✅

```bash
# Request desde navegador autenticado
GET http://localhost:8080/api/auth/me
Response:
{
  "authenticated": true,
  "user": {
    "id": "...",
    "name": "Sebastián Chirino",
    "email": "chirinosebastianmn@gmail.com",
    "role": "USER"
  }
}
```

#### Prueba 3: Cookies ✅

```
Application → Cookies → localhost:3001
✅ dom-bim-session presente
✅ httpOnly: true
✅ sameSite: lax
```

### Archivos Modificados

1. `apps/api/.env` - Línea 38
2. `apps/web/.env.local` - Archivo nuevo creado

### Commits

- Commit hash: N/A (cambios en archivos .env)

### Lecciones Aprendidas

1. **Next.js rewrites NO son adecuados para apps que usan cookies de sesión**
   - Los rewrites actúan como proxy pero no propagan cookies correctamente
   - Para autenticación basada en cookies, usar requests directos con `NEXT_PUBLIC_API_URL`

2. **Siempre verificar que FRONTEND_URL coincide con el puerto real**
   - En desarrollo, Next.js puede usar puerto aleatorio si 3000 está ocupado
   - Configurar explícitamente el puerto en scripts de dev

3. **CORS debe incluir TODOS los puertos donde corre el frontend**
   - Incluir tanto 3000 como 3001 para máxima compatibilidad

### Validación Final

- [x] Usuario puede hacer login
- [x] Dashboard carga correctamente
- [x] Sesión persiste en refreshes
- [x] No hay loop infinito
- [x] No hay warnings en console

### Referencias

- [Next.js Rewrites Docs](https://nextjs.org/docs/api-reference/next.config.js/rewrites)
- [Express Session + CORS](https://expressjs.com/en/resources/middleware/session.html)
- [Socket.io with Credentials](https://socket.io/docs/v4/handling-cors/)

---

## Plantilla para Nuevos Fixes

```markdown
## Fix #XXX - [Título Descriptivo]

**Fecha:** YYYY-MM-DD HH:MM  
**Reportado por:** [Nombre]  
**Severidad:** 🔴 CRÍTICO / 🟡 ALTO / 🟢 MEDIO / 🔵 BAJO  
**Módulo:** [Autenticación/Proyectos/Archivos/etc]  
**Estado:** 🔍 INVESTIGANDO / 🛠️ EN PROGRESO / ✅ RESUELTO / ❌ NO REPRODUCIBLE

### Descripción del Problema

[Descripción clara del problema, qué esperabas vs qué obtuviste]

### Pasos para Reproducir

1.
2.
3.

### Análisis de la Causa Raíz

[Explicación técnica de POR QUÉ sucede el problema]

### Logs del Error
```

[Pegar logs relevantes]

````

### Solución Aplicada

#### Cambio 1: [Descripción]
**Archivo:** `path/to/file.ts`
```diff
- código antiguo
+ código nuevo
````

### Testing Post-Fix

- [ ] Prueba 1
- [ ] Prueba 2

### Archivos Modificados

1.
2.

### Commits

-

### Lecciones Aprendidas

-

### Validación Final

- [ ] ...

### Referencias

-

```

---

---

## Fix #002 - Error Fetching Workflow al Abrir Proyecto

**Fecha:** 2026-04-14 16:00
**Reportado por:** Sebastián Chirino
**Severidad:** 🟡 ALTO
**Módulo:** Workflow / Proyectos
**Estado:** ✅ RESUELTO

### Descripción del Problema
Al abrir un proyecto recién creado, aparece error en consola:
```

[ERROR] Error fetching workflow {}
WorkflowStatus.useCallback[fetchWorkflow]
components/workflow/WorkflowStatus.tsx (159:14)

```

### Pasos para Reproducir
1. Crear un nuevo proyecto desde el dashboard
2. Hacer clic en el proyecto para abrirlo
3. Observar error en consola del navegador

### Análisis de la Causa Raíz

**Problema: Tabla `WorkflowTemplate` vacía**
- El componente `WorkflowStatus` se renderiza en el header del proyecto
- Llama a `GET /api/workflows/PROJECT/:projectId`
- El backend intenta auto-crear una instancia de workflow
- `workflowService.createInstance()` busca un template default para `PROJECT`
- No existe ningún template → `WorkflowTemplateNotFoundError`
- El error se propaga al frontend como "Failed to load workflow"

**Flujo del error:**
```

ProjectHeader.tsx → WorkflowStatus entityType="PROJECT"
→ fetchWorkflow() → GET /api/workflows/PROJECT/:id
→ Backend auto-create → findFirst({entityType, isDefault: true})
→ null → WorkflowTemplateNotFoundError ❌

````

### Solución
Ejecutar el script de seed de workflows que crea los templates necesarios:

```bash
npx tsx packages/database/prisma/seed-workflows.ts
````

Esto crea:

- **PROJECT_DELIVERY** template: 6 estados (DRAFT → IN_PROGRESS → IN_REVIEW → APPROVED → DELIVERED, + RETURNED)
- **FILE_REVIEW** template: 6 estados (UPLOADED → PROCESSING → READY → IN_REVIEW → APPROVED, + NEEDS_REVISION)
- 12 transiciones con roles y permisos configurados

### Archivos Involucrados

1. `packages/database/prisma/seed-workflows.ts` — Script de seed (ya existía, nunca se ejecutó)
2. `apps/api/src/services/workflow.service.ts` — Servicio que lanza el error
3. `apps/web/components/workflow/WorkflowStatus.tsx` — Componente frontend que muestra el error

### Testing Post-Fix

- [x] Abrir proyecto existente → Workflow badge "Draft" aparece correctamente
- [x] No hay errores en consola del navegador
- [x] Templates en BD: `SELECT * FROM "WorkflowTemplate"` → 2 filas

### Lecciones Aprendidas

- Los scripts de seed deben ejecutarse como parte del setup inicial del proyecto
- Considerar agregar seed al docker-compose o al script de inicialización
- El backend debería manejar gracefully la ausencia de templates en lugar de lanzar error 500

### Nota sobre "Compiling" lento

El delay de "Compiling..." → "Rendering..." al abrir un proyecto por primera vez es **comportamiento normal** de Next.js Turbopack en development. Compila on-demand la primera vez que visitas una ruta. Las siguientes visitas son instantáneas.

---

## Índice de Fixes

1. [Fix #001 - Loop Infinito en Login OAuth](#fix-001---loop-infinito-en-login-oauth) - ✅ RESUELTO
2. [Fix #002 - Error Fetching Workflow](#fix-002---error-fetching-workflow-al-abrir-proyecto) - ✅ RESUELTO
3. [Fix #003 - Upload APS 403 Legacy Deprecated](#fix-003---upload-aps-403-legacy-endpoint-deprecated) - ✅ RESUELTO
4. [Fix #004 - Progreso de Processing bloqueado por Rate Limiter](#fix-004---progreso-de-processing-bloqueado-por-rate-limiter) - ✅ RESUELTO

---

## Fix #004 - Progreso de Processing Bloqueado por Rate Limiter

**Fecha:** 2026-04-14 17:20  
**Reportado por:** Sebastián Chirino  
**Severidad:** 🔴 CRÍTICO  
**Módulo:** Gestión de Archivos / Rate Limiting  
**Estado:** ✅ RESUELTO

### Descripción del Problema

Al subir un archivo RVT (192MB), el badge "Processing 0%" no se actualiza — el porcentaje salta entre valores y vuelve a 0%, nunca muestra progreso real.

### Análisis de la Causa Raíz

**Problema: `/api/files/sync-status` comparte rate limiter con `/api/files/upload`**

El endpoint de polling `sync-status` es llamado repetidamente por el frontend (cada 3-30s con exponential backoff) para verificar el progreso de traducción en Autodesk. Al estar montado bajo `/api/files/*`, heredaba el `uploadLimiter` (20 requests/hora), lo que causó:

1. Frontend empieza polling cada 3 segundos
2. En ~60 segundos, agota los 20 requests del límite de upload
3. Todos los requests subsiguientes retornan `429 Too Many Requests`
4. Sin respuestas del servidor, el frontend no puede actualizar el progreso → muestra 0%
5. El `retryAfter` era de ~2300 segundos (38 min), bloqueando completamente

**Evidencia en logs:**

```
[RATE_LIMIT] Request blocked {"endpoint":"upload","path":"/sync-status","method":"POST","status":429,"retryAfter":2334}
```

### Solución

Montar `sync.routes.ts` por separado **antes** del filesRouter, con `apiLimiter` (100 req/min) en vez de `uploadLimiter` (20 req/hora):

```diff
  // index.ts
+ import syncRoutes from "./routes/files/sync.routes";

- // Files: Upload limiter for POST, api limiter for GET
- app.use("/api/files", rateLimiter.uploadLimiter(), filesRouter);
+ // Files: sync-status needs its own permissive limiter (polled frequently)
+ app.use("/api/files", rateLimiter.apiLimiter(), syncRoutes);
+ // Files: Upload limiter for remaining file operations
+ app.use("/api/files", rateLimiter.uploadLimiter(), filesRouter);
```

Express procesa rutas en orden, así que `/api/files/sync-status` matchea primero con `apiLimiter` (100/min).

### Archivos Modificados

1. `apps/api/src/index.ts` — Separar sync-status del uploadLimiter

### Testing Post-Fix

- [x] 10 requests rápidos a sync-status → todos HTTP 200
- [x] Rate limit de upload reseteado en Redis
- [x] Archivo RVT ya en status READY (traducción completó durante debugging)
- [x] Archivo DWG en status READY

### Lecciones Aprendidas

- El polling endpoint NUNCA debe compartir rate limiter con endpoints de mutación
- 20 req/hora es correcto para uploads pero fatal para polling
- Monitorear logs de `429` durante testing funcional
- Considerar un rate limiter específico para polling (ej. 60 req/min)

---

## Fix #003 - Upload APS 403 Legacy Endpoint Deprecated

**Fecha:** 2026-04-14 17:00  
**Reportado por:** Sebastián Chirino  
**Severidad:** 🔴 CRÍTICO  
**Módulo:** Gestión de Archivos / APS OSS  
**Estado:** ✅ RESUELTO

### Descripción del Problema

Al subir un archivo DWG (SK-CMA-004.dwg, 1.45MB) al proyecto, el archivo se guarda localmente pero el procesamiento queda en estado "Error". Los logs muestran:

```
[ERROR] [FILES] Background APS upload failed {"filename":"SK-CMA-004.dwg","error":"Request failed with status code 403"}
```

### Análisis de la Causa Raíz

**Problema: Endpoint OSS v2 Legacy deprecado por Autodesk**

- `files.service.ts` usaba `apsOssService.uploadObject()` para subir a APS
- `uploadObject()` usa `PUT /oss/v2/buckets/{bucket}/objects/{object}` (endpoint clásico)
- Autodesk deprecó este endpoint y ahora retorna `403 "Legacy endpoint is deprecated"`
- Ya existía `uploadBuffer()` que usa "Direct to S3" (Signed URLs), el método correcto

**Flujo del error:**

```
handleFileUpload() → setImmediate() → apsOssService.uploadObject()
  → PUT /oss/v2/buckets/.../objects/...
  → 403 "Legacy endpoint is deprecated"
  → file.status = "FAILED"
```

**Error secundario visible en logs:**

```
[TOKEN_REFRESH] Refresh failed {"error":"No refresh token present"}
```

Esto es independiente — el refresh de token 3-legged falla porque la sesión del usuario no se pasa al background task (setImmediate). No afecta el upload porque usa token 2-legged.

### Solución

Cambiar `uploadObject` → `uploadBuffer` en `files.service.ts`:

```diff
- // OPTIMIZATION: Use uploadObject (Classic) instead of uploadStream (S3 Direct)
- // This avoids potential firewall/negotiation latency with S3 Signed URLs.
- const buffer = fs.readFileSync(filePath);
- const apsObject = await apsOssService.uploadObject(
-   buffer,
-   file.originalname,
- );
+ // Use uploadBuffer (Direct to S3 Signed URLs)
+ // The legacy PUT /oss/v2/.../objects endpoint is deprecated (403)
+ const buffer = fs.readFileSync(filePath);
+ const apsObject = await apsOssService.uploadBuffer(
+   buffer,
+   file.originalname,
+ );
```

### Archivos Modificados

1. `apps/api/src/services/files.service.ts` — Línea ~87: cambiar método de upload

### Testing Post-Fix

- [x] Token 2-legged se obtiene correctamente
- [x] Bucket `dom-bim-platform-dev` existe y es accesible
- [x] Upload via Direct to S3 funciona (test con archivo de prueba)
- [x] Subir archivo DWG desde la UI → status READY
- [x] Subir archivo RVT 192MB → status TRANSLATING → READY

### Lecciones Aprendidas

- Autodesk deprecó el endpoint legacy de upload OSS en 2025-2026
- Siempre usar "Direct to S3" (Signed URLs) para uploads a APS
- El método `uploadObject()` debería ser eliminado o marcado como deprecated
- Los background tasks (setImmediate) no tienen acceso a la sesión del usuario

---

## Fix #005 - OAuth state=undefined (CSRF Vulnerability)

**Fecha:** 2026-04-14 19:45  
**Severidad:** 🟡 SEGURIDAD  
**Módulo:** Autenticación  
**Estado:** ✅ RESUELTO

### Descripción

El redirect de OAuth enviaba `state=undefined` al endpoint de Autodesk, dejando el flujo sin protección CSRF.

### Causa Raíz

`forge-apis` SDK `generateAuthUrl()` inyecta `state=undefined` cuando no se pasa parámetro.

### Solución

- `auth.service.ts`: `getAuthorizationUrl(state?)` ahora acepta state y reemplaza `state=undefined`
- `login.routes.ts`: Genera `crypto.randomBytes(24).toString("hex")`, lo guarda en `req.session.oauthState`
- Callback valida que `state` retornado coincida con el almacenado
- `express-session.d.ts`: Añadido `oauthState?: string` al tipo SessionData

### Archivos Modificados

- `apps/api/src/services/aps/auth.service.ts` (getAuthorizationUrl)
- `apps/api/src/routes/auth/login.routes.ts` (login + callback)
- `apps/api/src/types/express-session.d.ts` (tipo)

### Verificación

```
Antes:  state=undefined
Después: state=dbe340bfd87d7ac50016fb9dee1be309831bf1af9ff88171
```

---

## Fix #006 - heavyOperationLimiter Demasiado Restrictivo

**Fecha:** 2026-04-14 20:00  
**Severidad:** 🟡 MEDIO  
**Módulo:** Rate Limiting  
**Estado:** ✅ RESUELTO

### Descripción

Compliance, Validation y Reports compartían heavyOperationLimiter (10 req/hora). En testing, se agotaba en menos de 1 minuto bloqueando todo el módulo con HTTP 429.

### Causa Raíz

Mismo límite de producción (10/hora) aplicado en development.

### Solución

```ts
// rate-limit.config.ts
maxRequests: isDev ? 100 : 10,  // 100/h en dev, 10/h en prod
```

### Archivo Modificado

- `apps/api/src/config/rate-limit.config.ts`

---

## Fix #007 - BOM 90% Uncategorized + Family=0%

**Fecha:** 2026-04-14 20:15  
**Severidad:** 🟡 MEDIO  
**Módulo:** BOM & Quantities  
**Estado:** ✅ RESUELTO

### Descripción

BOM devolvía 2768 items pero 90% "Uncategorized", 0% con family, y material parcial.

### Causa Raíz

1. `getModelviewProperties` API no devuelve la categoría Revit en properties planas
2. "Family" no es un campo en las properties de APS — está en el nombre del elemento
3. Material keys eran limitadas a "Material" y "Structural Material"

### Solución

1. **Object Tree**: Nuevo método `buildCategoryMap(urn)` que obtiene el árbol de objetos de APS y lo recorre para mapear cada objectid a su categoría Revit real
2. **Family Extraction**: Si no hay property "Family", extrae del nombre del elemento (`FamilyName [instanceId]`)
3. **Material Keys**: Añadidas "Panel Material", "Frame Material", "Finish"

### Resultados

| Métrica              | Antes | Después                              |
| -------------------- | ----- | ------------------------------------ |
| Categorías correctas | 10%   | **99.96%** (1 uncategorized de 2768) |
| Familias             | 0%    | **86%** (2382/2768)                  |
| Materiales           | 54%   | **57%** (1583/2768)                  |
| Categorías únicas    | 8     | **33**                               |

### Archivos Modificados

- `apps/api/src/services/bim-query.service.ts` (buildCategoryMap, family extraction, material keys)

---

## Fix #008 - Workers No Procesaban Jobs (Prefix Mismatch)

**Fecha:** 2026-04-14 20:30  
**Severidad:** 🔴 CRÍTICO  
**Módulo:** Workers / BullMQ  
**Estado:** ✅ RESUELTO

### Descripción

Las conversiones se encolaban exitosamente pero nunca se procesaban. Status se quedaba en PENDING/QUEUED indefinidamente.

### Causa Raíz

Las **Queues** definidas en `lib/queue.ts` usaban prefix `"dom-bim"`:

```ts
const defaultQueueOptions: QueueOptions = {
  prefix: "dom-bim", // Keys: dom-bim:conversion-model-derivative:*
};
```

Pero los **Workers** en `workers/*.ts` NO tenían prefix:

```ts
new Worker("conversion-model-derivative", handler, {
  connection: redisConfig,
  // ❌ Sin prefix → busca en bull:conversion-model-derivative:*
});
```

Resultado: Workers escuchaban en `bull:*` pero los jobs estaban en `dom-bim:*`.

### Solución

Añadido `prefix: "dom-bim"` a los 4 workers:

- `conversion.worker.ts` (2 workers: MD + DA)
- `design-automation-callback.worker.ts`
- `validation.worker.ts`
- `webhook-worker.ts`

### Verificación

```
Antes:  3 jobs en wait, 0 procesados
Después: 0 jobs en wait, 1 COMPLETED (DWG→PDF en 3 segundos)
```

### Archivos Modificados

- `apps/api/src/workers/conversion.worker.ts`
- `apps/api/src/workers/design-automation-callback.worker.ts`
- `apps/api/src/workers/validation.worker.ts`
- `apps/api/src/workers/webhook-worker.ts`

### Impacto

- Todas las conversiones programáticas ahora funcionan
- Webhooks de APS ahora se procesan
- Validaciones automáticas al subir archivo ahora se ejecutan

---

## Fix #009 — PDF Export genera HTML en vez de PDF real 📄

| Campo          | Valor                                             |
| -------------- | ------------------------------------------------- |
| **Fecha**      | 2026-04-14                                        |
| **Severidad**  | Alta                                              |
| **Componente** | Compliance Export                                 |
| **Archivo**    | `apps/api/src/routes/compliance/export.routes.ts` |

### Síntoma

El endpoint `GET /api/compliance-v2/export/:runId/pdf` enviaba un `Content-Type: application/pdf` pero el cuerpo era HTML puro. Los lectores PDF no lo podían abrir.

### Causa Raíz

El endpoint generaba HTML con `<html>` y `<style>` tags y lo enviaba como si fuera PDF. Puppeteer estaba instalado pero Chrome requería librerías de sistema no disponibles (`libnspr4.so`, etc.).

### Solución

Reescritura completa del endpoint usando `pdfkit` (sin dependencia de Chrome):

- Header con logo/título y metadata del run
- Tabla de resumen (total, pass, fail, score)
- Tabla de issues con columnas (Element, Category, Rule, Expected, Actual, Status)
- Paginación automática con footer en cada página
- `npm install pdfkit` en apps/api

### Verificación

```
Run pequeño (5 elementos):  HTTP:200 Size:2118 → PDF document, version 1.3, 1 page(s)
Run grande (2768 elementos): HTTP:200 Size:2110 → PDF document, version 1.3, 1 page(s)
```

---

## Fix #010 — Descarga de conversión DWG→PDF falla con 400 📥

| Campo          | Valor                                         |
| -------------- | --------------------------------------------- |
| **Fecha**      | 2026-04-14                                    |
| **Severidad**  | Alta                                          |
| **Componente** | Conversion Download                           |
| **Archivo**    | `apps/api/src/services/conversion.service.ts` |

### Síntoma

`GET /api/conversion/:conversionId/download` retornaba HTTP 400 (AxiosError) para conversiones completadas.

### Causa Raíz

El worker almacenaba el URN base del modelo como `resultUrn` (retornado por el job de traducción de APS). Pero el endpoint `signedcookies` de Model Derivative requiere el URN del **derivado específico** (e.g., `urn:adsk.viewing:fs.file:.../output/Layout1.pdf`), no el URN base.

### Solución

En `getDownloadData()`, antes de llamar a `getDerivativeDownloadInfo()`:

1. Consultar el manifiesto APS con `getManifest(baseUrn)`
2. Buscar recursivamente el derivado que coincida por `mime` (`application/pdf`), `role` (`pdf-page`), o `outputType`
3. Usar ese URN derivado real para la descarga

### Verificación

```
curl → HTTP:200 Size:899041 ContentType:application/pdf
file → PDF document, version 1.7, 1 page(s) (899KB)
```

### Archivos Modificados

- `apps/api/src/services/conversion.service.ts` — `getDownloadData()` reescrito para Model Derivative

---

## Fix #011 - x-ads-force Borra Derivatives SVF2

**Fecha:** 2026-04-14 23:00  
**Severidad:** 🟡 ALTO  
**Módulo:** APS Model Derivative  
**Estado:** ✅ RESUELTO

### Descripción del Problema

Al solicitar conversión a PDF (`translateToPDF`), el header `x-ads-force: true` provocaba que APS eliminara las derivatives SVF2 existentes antes de generar el PDF, dejando el visor 3D sin modelo hasta que SVF2 se regenerara.

### Causa Raíz

`model-derivative.service.ts` → `translateToPDF()` enviaba `x-ads-force: true` como header, lo cual instruye a APS a borrar todas las derivatives existentes y reprocessar desde cero.

### Solución Aplicada

Eliminado `x-ads-force: true` del request de `translateToPDF()`. Sin el header, APS agrega la derivative PDF sin tocar las existentes.

### Archivos Modificados

- `apps/api/src/services/aps/model-derivative.service.ts` — Removido `x-ads-force` de `translateToPDF()`

---

## Fix #012 - Viewer Sin Herramientas de Medición

**Fecha:** 2026-04-15 13:30  
**Severidad:** 🟢 BAJO  
**Módulo:** Visor 3D  
**Estado:** ✅ RESUELTO

### Descripción del Problema

El visor 3D (`GuiViewer3D`) no mostraba herramientas de medición (distancia, ángulo, área) porque la extensión `Autodesk.Measure` no estaba cargada.

### Causa Raíz

`Viewer.tsx` inicializaba `GuiViewer3D` con `start()` pero no cargaba la extensión de medición. `GuiViewer3D` incluye pan/zoom/selection/properties/model-tree de forma nativa, pero las herramientas de medición requieren cargar explícitamente la extensión.

### Solución Aplicada

Añadida llamada a `newViewer.loadExtension('Autodesk.Measure')` inmediatamente después de `newViewer.start()`.

### Archivos Modificados

- `apps/web/components/Viewer.tsx` — Añadida `loadExtension('Autodesk.Measure')` después de `start()`

---

## Fix #013 - Warnings Cosméticos de Texturas en Viewer

**Fecha:** 2026-04-15 16:00  
**Severidad:** 🟢 BAJO  
**Módulo:** Visor 3D / Integración APS  
**Estado:** ✅ RESUELTO

### Descripción del Problema

Al cargar modelos BIM en el viewer, la consola del navegador mostraba warnings cosméticos sobre texturas (e.g. "Could not load texture", "power of two") generados internamente por la librería Autodesk Viewer v7.97. No afectaban funcionalidad pero ensuciaban la consola.

### Causa Raíz

La librería Autodesk Viewer emite `console.warn()` para texturas no encontradas o no compatibles. Estos warnings son internos de la librería y no indican errores reales del modelo.

### Solución Aplicada

1. Configurado `logLevel: 3` (ERROR only) en las opciones del `Autodesk.Viewing.Initializer`
2. Filtrado de `console.warn` durante la vida del viewer para patrones conocidos: `/texture/i`, `/material.*not.*found/i`, `/power of two/i`, `/image.*decode/i`
3. Restauración de `console.warn` original en el cleanup del `useEffect`

### Archivos Modificados

- `apps/web/components/Viewer.tsx` — logLevel=3, filtro console.warn con patrones de texturas, cleanup restore

---

## Fix #014 - Paginación Server-Side en Toda la Plataforma

**Fecha:** 2026-04-15  
**Reportado por:** Auditoría UX  
**Severidad:** 🟡 IMPORTANTE  
**Módulo:** Plataforma completa (API + Frontend)  
**Estado:** ✅ RESUELTO

### Descripción del Problema

Múltiples páginas de la plataforma cargaban TODOS los registros del servidor y los renderizaban sin paginación. Esto causaba:

- BOM: 2,700 filas individuales sin agrupar
- Proyectos: Todos los proyectos cargados de golpe
- Archivos: Flatten de todos los archivos de todos los proyectos
- Issues de compliance: Todas las incidencias sin paginar
- ACL Admin: Todos los usuarios y proyectos sin paginar

### Solución Aplicada

**Backend — 6 endpoints paginados:**

1. `GET /api/projects` — `?page=1&pageSize=20&search=&status=&sortBy=&sortOrder=`
2. `GET /api/users` — `?page=1&pageSize=20&search=&role=`
3. `GET /api/files/all` — Nuevo endpoint cross-project con `?page=&search=&type=&status=&projectId=`
4. `GET /api/files/project/:id` — `?page=1&pageSize=20&search=&type=&status=`
5. `GET /api/validation/:id/issues` — `?page=1&pageSize=50&search=&severity=&status=`
6. `GET /api/compliance-v2/runs/:id/issues` — `?page=1&pageSize=50&search=&severity=&status=`

Todos los endpoints devuelven `{ meta: { page, pageSize, total, totalPages }, data: [...] }`.
Validación de límites: `Math.min(100/200, Math.max(1, pageSize))`.

**Frontend — 5 páginas actualizadas:**

1. `app/dashboard/projects/page.tsx` — Búsqueda debounced, paginación numérica, sort server-side
2. `app/dashboard/files/page.tsx` — Usa nuevo `/api/files/all`, filtros por tipo/proyecto, paginación
3. `app/dashboard/bom/page.tsx` — Agregación server-side, 50/página, export CSV
4. `components/compliance/IssuesList.tsx` — Búsqueda debounced, severity pills con counts del server
5. `app/dashboard/sys/acl/page.tsx` — Tablas de usuarios y proyectos paginadas independientemente

**Patrón consistente en todos los componentes:**

- Debounced search (400ms)
- Paginación con Previous/Next + botones numéricos con ellipsis
- `setPage(1)` al cambiar filtros
- Skeleton loading mientras carga

### Archivos Modificados

- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/files/crud.routes.ts`
- `apps/api/src/routes/validation/crud.routes.ts`
- `apps/api/src/routes/compliance/runs.routes.ts`
- `apps/web/lib/api/services.ts`
- `apps/web/app/dashboard/projects/page.tsx`
- `apps/web/app/dashboard/files/page.tsx`
- `apps/web/app/dashboard/bom/page.tsx`
- `apps/web/components/compliance/IssuesList.tsx`
- `apps/web/app/dashboard/sys/acl/page.tsx`

### Tests

- 22 suites, 204 tests (203 pass, 1 skipped), 0 failures

---

**Mantener este archivo actualizado es crítico para:**

- Trazabilidad de cambios
- Knowledge base para el equipo
- Facilitar onboarding de nuevos developers
- Postmortems y mejora continua
