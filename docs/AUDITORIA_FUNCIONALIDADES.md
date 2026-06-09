# 🔍 Auditoría de Funcionalidades - DOM BIM Platform

**Fecha de creación:** 2026-04-14  
**Última actualización:** 2026-04-14  
**Estado general:** 🟡 En auditoría

---

## 📊 Resumen Ejecutivo

| Categoría                     | Total  | ✅ OK  | ⚠️ Parcial | ❌ Error | 🔍 No Testeado |
| ----------------------------- | ------ | ------ | ---------- | -------- | -------------- |
| **Autenticación**             | 8      | 2      | 0          | 0        | 6              |
| **Gestión de Proyectos**      | 12     | 3      | 0          | 0        | 9              |
| **Gestión de Archivos**       | 10     | 3      | 0          | 0        | 7              |
| **Visor 3D**                  | 8      | 1      | 1          | 0        | 6              |
| **Validación/Compliance**     | 15     | 0      | 0          | 0        | 15             |
| **Sistema de Notificaciones** | 6      | 0      | 0          | 0        | 6              |
| **BOM & Quantities**          | 5      | 0      | 0          | 0        | 5              |
| **Conversión de Archivos**    | 7      | 1      | 0          | 0        | 6              |
| **Administración**            | 6      | 0      | 0          | 0        | 6              |
| **Integración APS**           | 10     | 2      | 0          | 0        | 8              |
| **WebSocket/Socket.io**       | 4      | 0      | 0          | 0        | 4              |
| **Workers/Jobs**              | 5      | 0      | 0          | 0        | 5              |
| **TOTAL**                     | **96** | **12** | **1**      | **0**    | **83**         |

**Leyenda:**

- ✅ **Funcionando correctamente** - Sin errores, comportamiento esperado
- ⚠️ **Funcionamiento parcial** - Funciona pero con limitaciones o warnings
- ❌ **No funciona** - Error crítico que impide el uso
- 🔍 **No testeado** - Pendiente de verificación
- 🚧 **En desarrollo** - Funcionalidad incompleta por diseño

---

## 1️⃣ AUTENTICACIÓN Y SESIONES

### 1.1 Login con Autodesk OAuth ✅

**Estado:** ✅ Funcionando  
**Prioridad:** 🔴 CRÍTICA  
**Última prueba:** 2026-04-14 15:30

**Descripción:**  
Permite a los usuarios iniciar sesión usando sus credenciales de Autodesk Platform Services (APS).

**Flujo esperado:**

1. Usuario hace clic en "Sign In with Autodesk"
2. Redirige a `idp.auth.autodesk.com`
3. Usuario autentica en Autodesk
4. Callback a `/api/auth/callback`
5. Usuario redirigido a `/dashboard`

**✅ Resultado de prueba:**

- **Fecha:** 2026-04-14 15:30
- **Usuario testeado:** chirinosebastianmn@gmail.com
- **Resultado:** Exitoso
- **Observaciones:**
  - Loop infinito resuelto mediante configuración de `FRONTEND_URL=http://localhost:3001`
  - Cookies de sesión funcionando correctamente con Redis
  - Dashboard carga correctamente con datos del usuario

**Cambios aplicados:**

- `apps/api/.env`: Actualizado `FRONTEND_URL=http://localhost:3001`
- `apps/web/.env.local`: Creado con `NEXT_PUBLIC_API_URL=http://localhost:8080`

---

### 1.2 Verificación de Sesión (GET /api/auth/me) ✅

**Estado:** ✅ Funcionando  
**Prioridad:** 🔴 CRÍTICA  
**Última prueba:** 2026-04-14 16:00

**Descripción:**  
Endpoint que verifica si el usuario tiene una sesión activa y devuelve sus datos.

**Endpoint:** `GET /api/auth/me`

**✅ Resultado de prueba:**

- **Fecha:** 2026-04-14 16:00
- **Resultado:** Exitoso
- **Observaciones:**
  - Sin sesión: respuesta vacía (no 401, se valida en frontend)
  - Con sesión activa: Dashboard carga datos del usuario correctamente
  - Endpoint requiere autenticación en rutas protegidas (proyectos retorna 401)

**Pruebas completadas:**

- [x] Verificar respuesta con sesión activa (via navegador)
- [x] Verificar respuesta sin sesión (curl sin cookies → respuesta vacía)
- [x] Verificar que cookies se envían correctamente
- [ ] Verificar refresh automático de tokens

**Comandos de prueba:**

```bash
# Con sesión activa (desde navegador autenticado)
curl -b cookies.txt http://localhost:8080/api/auth/me

# Sin sesión
curl http://localhost:8080/api/auth/me
```

---

### 1.3 Cierre de Sesión (POST /api/auth/logout) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Permite al usuario cerrar su sesión, destruyendo la sesión de Redis y limpiando cookies.

**Endpoint:** `POST /api/auth/logout`

**Flujo esperado:**

1. Usuario hace clic en "Logout" en el menú
2. Request a `/api/auth/logout`
3. Sesión destruida en Redis
4. Cookies limpiadas
5. Redirect a página de login

**Pruebas pendientes:**

- [ ] Verificar que la sesión se destruye en Redis
- [ ] Verificar que las cookies se limpian
- [ ] Verificar redirect correcto
- [ ] Verificar que requests subsecuentes fallan con 401

---

### 1.4 Refresh de Tokens APS 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Sistema automático de refresh de tokens de Autodesk antes de que expiren.

**Middleware:** `sessionRefresh` en `apps/api/src/middleware/session-refresh.ts`

**Comportamiento esperado:**

- Tokens APS expiran cada 3600 segundos (1 hora)
- Sistema debe refrescar automáticamente cuando quedan < 5 minutos
- Usuario no debe percibir el refresh (transparente)

**Pruebas pendientes:**

- [ ] Verificar que el refresh se ejecuta automáticamente
- [ ] Verificar que sesión se actualiza en Redis
- [ ] Verificar comportamiento cuando refresh_token también expira
- [ ] Verificar logs de refresh exitoso
- [ ] Simular expiración para probar manejo de errores

---

### 1.5 Manejo de Token Expirado 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Cuando un token de APS expira y no se puede renovar, el sistema debe manejar el error correctamente.

**Comportamiento esperado:**

- Si refresh_token también expiró: logout automático + redirect a login
- Si error de red: reintentar antes de forzar logout
- Logs claros del motivo de expiración

**Pruebas pendientes:**

- [ ] Simular token expirado sin refresh_token
- [ ] Verificar que usuario es deslogueado
- [ ] Verificar mensaje de error al usuario
- [ ] Verificar que sesión se limpia completamente

---

### 1.6 Cambio de Cuenta (Force Login) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Permite al usuario cambiar de cuenta de Autodesk sin cerrar sesión primero.

**Botón:** "Sign in with different account" en página de login

**Endpoint:** `GET /api/auth/login?prompt=login`

**Comportamiento esperado:**

- Fuerza la pantalla de login de Autodesk aunque ya haya sesión
- Permite seleccionar otra cuenta
- Sesión anterior se reemplaza por la nueva

**Pruebas pendientes:**

- [ ] Verificar que fuerza selección de cuenta en Autodesk
- [ ] Verificar que sesión anterior se destruye
- [ ] Verificar que nueva sesión se crea correctamente

---

### 1.7 Gestión de Roles (ADMIN vs USER) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
El sistema asigna roles basándose en el email del usuario contra la lista `ADMIN_EMAILS`.

**Configuración actual:** `ADMIN_EMAILS=admin@example.com`

**Pruebas pendientes:**

- [ ] Verificar que admin@example.com obtiene rol ADMIN
- [ ] Verificar que chirinosebastianmn@gmail.com obtiene rol USER
- [ ] Verificar restricciones de endpoints ADMIN
- [ ] Probar acceso a `/api/admin/status` con USER (debe fallar)
- [ ] Probar acceso con ADMIN (debe funcionar)
- [ ] Verificar cambio de rol cuando email se agrega/quita de ADMIN_EMAILS

**Archivos relevantes:**

- `apps/api/src/routes/auth/login.routes.ts:165` - Determinación de rol
- `apps/api/src/middleware/auth.ts` - Middleware `requireAdmin`

---

### 1.8 Persistencia de "Last User" en Local Storage 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
El frontend guarda en localStorage el último usuario que inició sesión para mostrar su foto/nombre en la próxima visita.

**Archivo:** `apps/web/app/page.tsx`

**Comportamiento esperado:**

- Al hacer login exitoso, datos del usuario se guardan en `localStorage.dom_last_user`
- En próxima visita, esos datos se muestran
- Botón "Continue as [nombre]" pre-rellena la UI

**Pruebas pendientes:**

- [ ] Verificar que localStorage se actualiza después de login
- [ ] Verificar que datos se muestran correctamente en siguiente visita
- [ ] Verificar que funciona el botón "Continue as"
- [ ] Verificar manejo de localStorage corrupto/inválido

---

## 2️⃣ GESTIÓN DE PROYECTOS

### 2.1 Listar Proyectos (GET /api/projects) ✅

**Estado:** ✅ Funcionando  
**Prioridad:** 🔴 CRÍTICA  
**Última prueba:** 2026-04-14 16:00

**Descripción:**  
Lista todos los proyectos accesibles para el usuario actual, con paginación y filtros.

**Endpoint:** `GET /api/projects`

**Query params:**

- `page` (número de página)
- `limit` (elementos por página)
- `search` (búsqueda por nombre)
- `status` (filtro por estado: ACTIVE, ARCHIVED, etc.)

**Respuesta esperada:**

```json
{
  "projects": [...],
  "total": 0,
  "page": 1,
  "limit": 10
}
```

**✅ Resultado de prueba:**

- **Fecha:** 2026-04-14 16:00
- **Resultado:** Exitoso
- **Observaciones:**
  - Sin auth: retorna `{"error":"Authentication required"}` con stack trace (⚠️ stack visible en dev)
  - Con auth (navegador): Lista proyectos correctamente
  - Proyecto creado manualmente aparece en listado

**Pruebas completadas:**

- [x] Listar proyectos como USER (solo ve sus proyectos + compartidos)
- [ ] Listar proyectos como ADMIN (ve todos)
- [ ] Verificar paginación funciona
- [ ] Verificar búsqueda por nombre
- [ ] Verificar filtros por estado
- [ ] Verificar que muestra correctamente stats (archivos, miembros)

**Página frontend:** `/dashboard/projects`

---

### 2.2 Crear Proyecto (POST /api/projects) ✅

**Estado:** ✅ Funcionando  
**Prioridad:** 🔴 CRÍTICA  
**Última prueba:** 2026-04-14 16:00

**Descripción:**  
Permite crear un nuevo proyecto BIM.

**Endpoint:** `POST /api/projects`

**Body esperado:**

```json
{
  "name": "Hospital Norte",
  "description": "Proyecto hospital 500 camas",
  "clientName": "Ministerio de Salud",
  "location": "Santiago, Chile",
  "startDate": "2026-01-01",
  "endDate": "2027-12-31"
}
```

**Validaciones esperadas:**

- `name`: requerido, 3-200 caracteres
- `description`: opcional, máx 1000 caracteres
- Fechas en formato ISO 8601

**✅ Resultado de prueba:**

- **Fecha:** 2026-04-14 16:00
- **Usuario:** chirinosebastianmn@gmail.com
- **Resultado:** Exitoso
- **Observaciones:**
  - Proyecto creado exitosamente desde la UI
  - Se verificó en DB: `SELECT COUNT(*) FROM "Project"` → 1 fila
  - Proyecto aparece correctamente en el listado

**Pruebas completadas:**

- [x] Crear proyecto con datos válidos
- [x] Verificar que se crea en DB
- [x] Verificar que proyecto aparece en listado
- [ ] Verificar que usuario actual se asigna como owner
- [ ] Probar validaciones (nombre vacío, fechas inválidas)

**Botón frontend:** "New Project" en dashboard

---

### 2.3 Ver Detalle de Proyecto (GET /api/projects/:id) ❌ → ✅

**Estado:** ✅ Funcionando (tras Fix #002)  
**Prioridad:** 🟡 ALTA  
**Última prueba:** 2026-04-14 16:10

**Descripción:**  
Obtiene detalles completos de un proyecto específico.

**Endpoint:** `GET /api/projects/:id`

**Respuesta debe incluir:**

- Datos básicos del proyecto
- Lista de archivos asociados
- Lista de miembros del equipo
- Estadísticas (total archivos, validaciones pendientes)

**❌ Error encontrado (Fix #002):**

- Al abrir proyecto: `[ERROR] Error fetching workflow {}` en WorkflowStatus.tsx:159
- Causa: Tabla `WorkflowTemplate` vacía — seed nunca ejecutado
- Solución: Ejecutar `npx tsx packages/database/prisma/seed-workflows.ts`
- Ver: [REGISTRO_FIXES.md → Fix #002](./REGISTRO_FIXES.md)

**✅ Resultado post-fix:**

- **Fecha:** 2026-04-14 16:10
- **Resultado:** Exitoso
- **Observaciones:**
  - Página del proyecto carga correctamente
  - WorkflowStatus badge "Draft" aparece sin errores
  - "Compiling" delay es comportamiento normal de Turbopack en dev

**Pruebas completadas:**

- [x] Ver proyecto propio (owner)
- [ ] Ver proyecto compartido (member)
- [ ] Intentar ver proyecto sin acceso (debe dar 403)
- [ ] Verificar que incluye archivos
- [ ] Verificar que incluye miembros

**Página frontend:** `/dashboard/projects/[id]`

---

### 2.4 Actualizar Proyecto (PATCH /api/projects/:id) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Permite modificar datos de un proyecto existente.

**Endpoint:** `PATCH /api/projects/:id`

**Campos editables:**

- `name`
- `description`
- `clientName`
- `location`
- `startDate`
- `endDate`
- `status`

**Permisos:**

- Owner: puede editar todo
- Member con permisos: puede editar campos limitados
- Otros: sin acceso

**Pruebas pendientes:**

- [ ] Actualizar como owner
- [ ] Intentar actualizar como member sin permisos (debe fallar)
- [ ] Verificar que cambios se reflejan en DB
- [ ] Verificar logs de auditoría

---

### 2.5 Archivar Proyecto (POST /api/projects/:id/archive) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Cambia estado del proyecto a `ARCHIVED` sin eliminarlo.

**Endpoint:** `POST /api/projects/:id/archive`

**Comportamiento esperado:**

- Proyecto no se elimina de DB
- Status cambia a ARCHIVED
- Ya no aparece en listado activo (solo en "Archived")
- Archivos y datos se mantienen

**Pruebas pendientes:**

- [ ] Archivar proyecto como owner
- [ ] Verificar que no aparece en listado activo
- [ ] Verificar que archivos siguen accesibles
- [ ] Intentar archivar como no-owner (debe fallar)

---

### 2.6 Eliminar Proyecto (DELETE /api/projects/:id) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Elimina permanentemente un proyecto y todos sus archivos asociados.

**Endpoint:** `DELETE /api/projects/:id`

**⚠️ PELIGRO:** Acción irreversible

**Comportamiento esperado:**

- Solo owner o ADMIN pueden eliminar
- Elimina proyecto de DB
- Elimina todos los archivos de S3/OSS
- Elimina todos los registros de validación
- Elimina miembros del proyecto

**Pruebas pendientes:**

- [ ] Eliminar proyecto como owner
- [ ] Verificar que se elimina de DB
- [ ] Verificar que archivos S3 se eliminan
- [ ] Verificar que miembros se eliminan
- [ ] Intentar eliminar como USER normal (debe fallar)
- [ ] Verificar logs de auditoría

---

### 2.7 Agregar Miembro al Proyecto 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Permite invitar usuarios al proyecto con roles específicos.

**Endpoint:** `POST /api/projects/:id/members`

**Body esperado:**

```json
{
  "email": "user@example.com",
  "role": "EDITOR"
}
```

**Roles disponibles:**

- `VIEWER`: Solo lectura
- `EDITOR`: Subir/editar archivos
- `ADMIN`: Gestionar miembros

**Pruebas pendientes:**

- [ ] Agregar miembro como owner
- [ ] Verificar que miembro recibe notificación
- [ ] Verificar que miembro puede acceder al proyecto
- [ ] Probar roles diferentes
- [ ] Intentar agregar miembro como no-owner (debe fallar)

---

### 2.8 Quitar Miembro del Proyecto 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Pruebas pendientes:**

- [ ] Quitar miembro como owner
- [ ] Verificar que miembro pierde acceso
- [ ] Intentar quitarse a sí mismo (debe funcionar)

---

### 2.9 Cambiar Rol de Miembro 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Pruebas pendientes:**

- [ ] Cambiar rol de VIEWER a EDITOR
- [ ] Verificar que permisos cambian correctamente
- [ ] Solo owner puede cambiar roles

---

### 2.10 Estadísticas del Proyecto 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Dashboard muestra estadísticas agregadas del proyecto.

**Métricas esperadas:**

- Total de archivos
- Total de validaciones
- Estado de conversiones
- Miembros activos

**Pruebas pendientes:**

- [ ] Verificar que stats se calculan correctamente
- [ ] Verificar que se actualizan en tiempo real

---

### 2.11 Búsqueda y Filtrado de Proyectos 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Pruebas pendientes:**

- [ ] Búsqueda por nombre
- [ ] Filtro por estado
- [ ] Filtro por fecha
- [ ] Ordenamiento (por nombre, fecha)

---

### 2.12 Exportar Datos del Proyecto 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Permite exportar metadata del proyecto en formato JSON o Excel.

**Pruebas pendientes:**

- [ ] Exportar a JSON
- [ ] Exportar a Excel (si implementado)
- [ ] Verificar que incluye toda la información

---

## 3️⃣ GESTIÓN DE ARCHIVOS

### 3.1 Subir Archivo (POST /api/files/upload) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Permite subir archivos BIM (RVT, IFC, DWG, PDF) al sistema.

**Endpoint:** `POST /api/files/upload`

**Content-Type:** `multipart/form-data`

**Campos:**

- `file`: archivo binario
- `projectId`: ID del proyecto
- `name`: nombre descriptivo (opcional)

**Formatos soportados:**

- `.rvt` (Revit)
- `.ifc` (IFC)
- `.dwg` (AutoCAD)
- `.pdf` (PDF)
- `.nwc`, `.dwf`

**Límite de tamaño:** 200 MB (configurable)

**Flujo esperado:**

1. Usuario selecciona archivo
2. Archivo se sube al backend
3. Backend guarda en Autodesk OSS o S3
4. Se crea registro en DB
5. Se inicia conversión automática (si aplica)

**Pruebas pendientes:**

- [ ] Subir archivo RVT pequeño (< 10 MB)
- [ ] Subir archivo RVT grande (> 100 MB)
- [ ] Subir archivo IFC
- [ ] Subir archivo no soportado (debe rechazar)
- [ ] Verificar validación de tamaño máximo
- [ ] Verificar que archivo aparece en listado
- [ ] Verificar que conversión se inicia automáticamente

**Página frontend:** `/dashboard/files` - botón "Upload File"

---

### 3.2 Listar Archivos (GET /api/files) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Endpoint:** `GET /api/files`

**Query params:**

- `projectId`: filtrar por proyecto
- `type`: filtrar por tipo (RVT, IFC, PDF)
- `status`: filtrar por estado de conversión

**Pruebas pendientes:**

- [ ] Listar todos los archivos del usuario
- [ ] Filtrar por proyecto
- [ ] Filtrar por tipo
- [ ] Verificar paginación
- [ ] Verificar que muestra estado de conversión

---

### 3.3 Ver Detalle de Archivo (GET /api/files/:id) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Respuesta debe incluir:**

- Metadata del archivo
- Información de conversión
- Versiones (si hay varias)
- BOM (si fue extraído)

**Pruebas pendientes:**

- [ ] Ver detalle de archivo propio
- [ ] Verificar que muestra todas las propiedades
- [ ] Ver archivo de proyecto compartido

---

### 3.4 Descargar Archivo Original (GET /api/files/:id/download) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Genera URL firmada para descargar el archivo original desde OSS/S3.

**Endpoint:** `GET /api/files/:id/download`

**Comportamiento esperado:**

- Genera signed URL temporal (válida 1 hora)
- Redirect a la URL de descarga
- Usuario descarga archivo en formato original

**Pruebas pendientes:**

- [ ] Descargar archivo RVT
- [ ] Descargar archivo PDF
- [ ] Verificar que URL expira después de 1 hora
- [ ] Intentar descargar sin permisos (debe fallar)

---

### 3.5 Eliminar Archivo (DELETE /api/files/:id) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**⚠️ PELIGRO:** Acción irreversible

**Comportamiento esperado:**

- Elimina archivo de OSS/S3
- Elimina registro de DB
- Elimina versiones derivadas (SVF, thumbnail)
- Elimina BOM asociado

**Pruebas pendientes:**

- [ ] Eliminar archivo como owner
- [ ] Verificar que se elimina de almacenamiento
- [ ] Verificar que se elimina de DB
- [ ] Intentar eliminar sin permisos (debe fallar)

---

### 3.6 Gestión de Versiones de Archivo 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Sistema de control de versiones para archivos (v1, v2, v3...).

**Comportamiento esperado:**

- Subir nuevo archivo con mismo nombre crea nueva versión
- Versiones anteriores se mantienen
- Se puede restaurar versión anterior
- Se puede comparar versiones

**Pruebas pendientes:**

- [ ] Subir versión 2 del mismo archivo
- [ ] Verificar que v1 se mantiene
- [ ] Ver historial de versiones
- [ ] Comparar dos versiones

---

### 3.7 Búsqueda de Archivos 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Pruebas pendientes:**

- [ ] Búsqueda por nombre
- [ ] Filtro por tipo de archivo
- [ ] Filtro por proyecto
- [ ] Filtro por fecha de carga

---

### 3.8 Compartir Archivo con Otros Usuarios 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Pruebas pendientes:**

- [ ] Generar link de compartir
- [ ] Verificar permisos de acceso temporal

---

### 3.9 Metadata de Archivo 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Extracción y visualización de metadata del archivo.

**Metadata esperada:**

- Nombre original
- Tamaño
- Tipo MIME
- Fecha de carga
- Usuario que lo subió
- Checksums (MD5, SHA256)

**Pruebas pendientes:**

- [ ] Verificar que metadata se extrae correctamente
- [ ] Verificar que se muestra en UI

---

### 3.10 Thumbnails/Previews de Archivos 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Generación automática de thumbnails para preview rápido.

**Pruebas pendientes:**

- [ ] Verificar que se generan thumbnails
- [ ] Verificar que se muestran en listado
- [ ] Verificar fallback si thumbnail no está disponible

---

## 4️⃣ VISOR 3D (Autodesk Viewer)

### 4.1 Inicialización del Viewer 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Carga el Autodesk Forge Viewer en el navegador.

**Página frontend:** `/dashboard/viewer/[id]`

**Comportamiento esperado:**

1. Usuario hace clic en "View in 3D"
2. Página carga con loading
3. Viewer se inicializa con credenciales
4. Modelo 3D se carga desde URN

**Pruebas pendientes:**

- [ ] Abrir viewer con archivo convertido
- [ ] Verificar que viewer carga correctamente
- [ ] Verificar autenticación con APS
- [ ] Probar con archivo que AÚN NO ha sido convertido
- [ ] Verificar manejo de errores de carga

**Archivos relevantes:**

- `apps/web/app/dashboard/viewer/[id]/page.tsx`
- `apps/web/components/ModelViewer.tsx` (si existe)

---

### 4.2 Carga de Modelo BIM (Load URN) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Carga el modelo 3D desde el URN de Autodesk Model Derivative.

**URN:** Debe estar en formato Base64 con prefijo `urn:adsk.objects:os.object:`

**Pruebas pendientes:**

- [ ] Cargar modelo RVT convertido
- [ ] Cargar modelo IFC convertido
- [ ] Verificar geolocalización del modelo
- [ ] Verificar que propiedades se cargan

---

### 4.3 Navegación en el Modelo (Pan, Zoom, Rotate) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Controles esperados:**

- **Mouse izquierdo:** Rotar
- **Mouse derecho:** Pan
- **Scroll:** Zoom
- **Doble clic:** Zoom to fit

**Pruebas pendientes:**

- [ ] Rotar modelo
- [ ] Hacer pan
- [ ] Zoom in/out
- [ ] Fit to view
- [ ] Home view

---

### 4.4 Selección de Elementos 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Permite seleccionar elementos del modelo y ver sus propiedades.

**Comportamiento esperado:**

- Clic en elemento → se selecciona y resalta
- Panel lateral muestra propiedades del elemento
- Propiedades incluyen: ID, tipo, familia, parámetros

**Pruebas pendientes:**

- [ ] Seleccionar un muro
- [ ] Verificar que se resalta visualmente
- [ ] Verificar que propiedades se muestran
- [ ] Seleccionar múltiples elementos (Ctrl+clic)

---

### 4.5 Panel de Propiedades 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Panel que muestra propiedades del elemento seleccionado.

**Propiedades a mostrar:**

- Nombre/Tipo
- Familia
- Categoría
- Parámetros de instancia
- Parámetros de tipo

**Pruebas pendientes:**

- [ ] Verificar que propiedades se cargan
- [ ] Verificar que se pueden expandir/colapsar categorías
- [ ] Verificar búsqueda dentro de propiedades

---

### 4.6 Árbol de Modelo (Model Browser) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Árbol jerárquico que muestra estructura del modelo.

**Navegación esperada:**

- Raíz: Nombre del archivo
- Niveles: por disciplina, categoría, familia
- Selección en árbol → elemento se resalta en viewer

**Pruebas pendientes:**

- [ ] Ver árbol completo del modelo
- [ ] Expandir/colapsar nodos
- [ ] Seleccionar desde árbol
- [ ] Búsqueda en árbol

---

### 4.7 Herramientas de Medición 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Herramientas esperadas:**

- Medición de distancia
- Medición de ángulo
- Medición de área

**Pruebas pendientes:**

- [ ] Medir distancia entre dos puntos
- [ ] Verificar que medidas son correctas
- [ ] Limpiar mediciones

---

### 4.8 Gestión de Vistas y Cámaras 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Características esperadas:**

- Guardar vistas personalizadas
- Restaurar vistas guardadas
- Vistas predefinidas (Planta, Alzado, 3D)

**Pruebas pendientes:**

- [ ] Cambiar a vista de planta
- [ ] Cambiar a vista 3D
- [ ] Guardar vista actual
- [ ] Restaurar vista guardada

---

## 5️⃣ VALIDACIÓN Y COMPLIANCE

### 5.1 Crear Regla de Validación 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Permite crear reglas personalizadas de validación BIM.

**Endpoint:** `POST /api/compliance/rules`

**Tipos de reglas disponibles:**

- **Property Check:** Verificar valor de propiedad
- **Naming Convention:** Validar nombres según patrón
- **Quantity Check:** Verificar cantidades
- **Relationship Check:** Verificar relaciones entre elementos

**Body ejemplo:**

```json
{
  "name": "Muros deben tener tipo estructural",
  "description": "Todos los muros categoría 'Walls' deben tener propiedad 'Structural' = true",
  "category": "Walls",
  "propertyName": "Structural",
  "operator": "equals",
  "expectedValue": "true",
  "severity": "ERROR"
}
```

**Pruebas pendientes:**

- [ ] Crear regla de propiedad
- [ ] Crear regla de naming
- [ ] Verificar validaciones de campos
- [ ] Probar operadores (equals, contains, greaterThan)

**Página frontend:** `/dashboard/compliance/rules`

---

### 5.2 Listar Reglas de Validación 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Pruebas pendientes:**

- [ ] Listar todas las reglas
- [ ] Filtrar por categoría
- [ ] Filtrar por severidad
- [ ] Ver detalles de regla

---

### 5.3 Editar Regla de Validación 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Pruebas pendientes:**

- [ ] Modificar regla existente
- [ ] Verificar que cambios se reflejan
- [ ] Verificar que validaciones futuras usan regla actualizada

---

### 5.4 Eliminar Regla de Validación 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Pruebas pendientes:**

- [ ] Eliminar regla
- [ ] Verificar que validaciones anteriores se mantienen
- [ ] Verificar que nuevas validaciones no usan regla eliminada

---

### 5.5 Ejecutar Validación Manual 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Permite ejecutar validación BIM sobre un archivo manualmente.

**Endpoint:** `POST /api/validation/run`

**Body:**

```json
{
  "fileId": "uuid",
  "rulesetId": "uuid" // opcional, si no se especifica usa todas las reglas activas
}
```

**Flujo esperado:**

1. Usuario selecciona archivo
2. Usuario hace clic en "Run Validation"
3. Job se crea en BullMQ
4. Worker procesa validación
5. Resultados se almacenan en DB
6. Usuario recibe notificación

**Pruebas pendientes:**

- [ ] Ejecutar validación sobre archivo RVT
- [ ] Verificar que job se crea
- [ ] Verificar que worker lo procesa
- [ ] Verificar que resultados se muestran
- [ ] Probar con archivo que tiene errores
- [ ] Probar con archivo que cumple todas las reglas

**Página frontend:** `/dashboard/validation`

---

### 5.6 Ver Resultados de Validación 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Muestra resumen y detalle de resultados de una validación.

**Datos a mostrar:**

- Resumen: total issues, críticos, warnings, info
- Lista de issues con:
  - Elemento afectado
  - Regla violada
  - Severidad
  - Descripción del problema
  - Valor esperado vs actual

**Pruebas pendientes:**

- [ ] Ver resultados de validación exitosa
- [ ] Ver resultados con errores
- [ ] Filtrar issues por severidad
- [ ] Filtrar issues por tipo
- [ ] Exportar resultados a Excel/PDF

**Página frontend:** `/dashboard/compliance/results`

---

### 5.7 Resaltar Elementos con Issues en Viewer 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Integración entre validación y viewer: elementos con issues se resaltan en 3D.

**Comportamiento esperado:**

- Issues con severidad ERROR → resaltado en rojo
- Issues con severidad WARNING → resaltado en amarillo
- Clic en issue en lista → zoom al elemento en viewer

**Pruebas pendientes:**

- [ ] Ver archivo con issues en viewer
- [ ] Verificar que elementos se resaltan
- [ ] Hacer clic en issue → debe hacer zoom al elemento
- [ ] Verificar colores según severidad

---

### 5.8 Crear Ruleset (Conjunto de Reglas) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Agrupa múltiples reglas en un "ruleset" reutilizable.

**Ejemplos de rulesets:**

- "Estándares MOP Chile"
- "BIM Level 2 LATAM"
- "Nomenclatura DOM BIM"

**Pruebas pendientes:**

- [ ] Crear ruleset
- [ ] Agregar reglas al ruleset
- [ ] Ejecutar validación con ruleset específico
- [ ] Clonar/duplicar ruleset

---

### 5.9 Importar/Exportar Rulesets 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Permite compartir rulesets entre proyectos/organizaciones.

**Formatos:**

- JSON (estructura interna)
- Excel (para edición manual)

**Pruebas pendientes:**

- [ ] Exportar ruleset a JSON
- [ ] Importar ruleset desde JSON
- [ ] Verificar que reglas se importan correctamente

---

### 5.10 Validación Automática al Subir Archivo 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Opción para ejecutar validación automáticamente al subir un archivo.

**Configuración:** Por proyecto o global

**Pruebas pendientes:**

- [ ] Configurar validación automática
- [ ] Subir archivo
- [ ] Verificar que validación se ejecuta automáticamente
- [ ] Verificar notificación de resultados

---

### 5.11 Resolver/Ignorar Issues 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Permite marcar un issue como "resuelto" o "ignorado" con justificación.

**Estados de issue:**

- `OPEN`: Pendiente
- `RESOLVED`: Corregido
- `IGNORED`: Ignorado intencionalmente
- `FALSE_POSITIVE`: Issue erróneo

**Pruebas pendientes:**

- [ ] Marcar issue como resuelto
- [ ] Agregar comentario/justificación
- [ ] Marcar como ignorado
- [ ] Filtrar issues por estado

---

### 5.12 Historial de Validaciones 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Ver todas las validaciones ejecutadas sobre un archivo a lo largo del tiempo.

**Datos esperados:**

- Fecha de ejecución
- Usuario que ejecutó
- Ruleset usado
- Resultados (número de issues)

**Pruebas pendientes:**

- [ ] Ver historial de archivo
- [ ] Comparar resultados entre dos validaciones
- [ ] Ver evolución (mejoró o empeoró)

---

### 5.13 Notificaciones de Validación Fallida 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Sistema envía notificación cuando una validación detecta issues críticos.

**Canales:**

- In-app (campana de notificaciones)
- Email (si SMTP configurado)

**Pruebas pendientes:**

- [ ] Ejecutar validación con errores
- [ ] Verificar que aparece notificación
- [ ] Verificar que email se envía (si SMTP configurado)

---

### 5.14 Dashboard de Compliance 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Dashboard visual con métricas de compliance del proyecto.

**Métricas esperadas:**

- % de archivos validados
- Total de issues por severidad
- Tendencia histórica (mejorando/empeorando)
- Top 5 reglas más violadas

**Pruebas pendientes:**

- [ ] Ver dashboard de compliance
- [ ] Verificar que métricas son correctas

---

### 5.15 Validación de Clash Detection 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Detecta colisiones entre elementos de diferentes disciplinas.

**Pruebas pendientes:**

- [ ] Ejecutar clash detection
- [ ] Verificar que detecta colisiones reales
- [ ] Visualizar clashes en viewer

---

## 6️⃣ SISTEMA DE NOTIFICACIONES

### 6.1 Notificaciones In-App 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Campana de notificaciones en la esquina superior derecha del dashboard.

**Componente:** `NotificationBell` en `apps/web/components/NotificationBell.tsx`

**Tipos de notificaciones:**

- Validación completada
- Archivo subido
- Miembro agregado al proyecto
- Conversión completada
- Error en proceso

**Pruebas pendientes:**

- [ ] Verificar que campana muestra contador
- [ ] Hacer clic → abre panel de notificaciones
- [ ] Marcar notificación como leída
- [ ] Marcar todas como leídas
- [ ] Eliminar notificación

---

### 6.2 WebSocket para Notificaciones en Tiempo Real 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Conexión Socket.io entre frontend y backend para notificaciones push.

**Flujo:**

1. Frontend conecta a Socket.io al cargar dashboard
2. Backend emite eventos cuando sucede algo importante
3. Frontend recibe evento y muestra notificación

**Eventos esperados:**

- `notification:new` - Nueva notificación
- `validation:complete` - Validación terminada
- `file:converted` - Archivo convertido

**Pruebas pendientes:**

- [ ] Verificar que Socket.io conecta al cargar dashboard
- [ ] Simular evento desde backend
- [ ] Verificar que frontend recibe evento
- [ ] Verificar que notificación aparece sin refresh

**Archivos relevantes:**

- Backend: `apps/api/src/lib/socket.ts`
- Frontend: `apps/web/context/NotificationContext.tsx`

---

### 6.3 Crear Notificación Manualmente (Admin) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Endpoint:** `POST /api/notifications`

**Body:**

```json
{
  "userId": "uuid",
  "type": "INFO",
  "title": "Mantenimiento programado",
  "message": "El sistema estará en mantenimiento mañana de 2-4 AM"
}
```

**Pruebas pendientes:**

- [ ] Crear notificación como ADMIN
- [ ] Verificar que usuario la recibe
- [ ] Intentar crear como USER (debe fallar)

---

### 6.4 Listar Notificaciones del Usuario 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Endpoint:** `GET /api/notifications`

**Query params:**

- `unreadOnly`: solo no leídas
- `limit`: límite de resultados

**Pruebas pendientes:**

- [ ] Listar todas las notificaciones
- [ ] Filtrar solo no leídas
- [ ] Verificar paginación

---

### 6.5 Marcar Notificación como Leída 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Endpoint:** `PATCH /api/notifications/:id/read`

**Pruebas pendientes:**

- [ ] Marcar notificación como leída
- [ ] Verificar que contador disminuye
- [ ] Verificar que se actualiza en DB

---

### 6.6 Eliminar Notificación 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Endpoint:** `DELETE /api/notifications/:id`

**Pruebas pendientes:**

- [ ] Eliminar notificación
- [ ] Verificar que desaparece de la lista

---

## 7️⃣ BOM & QUANTITIES (Bill of Materials)

### 7.1 Extraer BOM de Archivo RVT 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Extrae automáticamente el Bill of Materials (lista de materiales) de un archivo Revit.

**Endpoint:** `POST /api/files/:id/bom/extract`

**Datos extraídos:**

- Categoría de elemento (Muro, Puerta, Ventana, etc.)
- Familia y Tipo
- Cantidades (cantidad, área, volumen)
- Parámetros personalizados

**Flujo esperado:**

1. Archivo RVT ya está convertido en APS
2. Usuario hace clic en "Extract BOM"
3. Job se crea en BullMQ
4. Worker descarga propiedades desde APS Model Derivative
5. Se parsean y almacenan en DB
6. BOM se muestra en tabla

**Pruebas pendientes:**

- [ ] Extraer BOM de archivo RVT
- [ ] Verificar que se procesan todas las categorías
- [ ] Verificar que cantidades son correctas
- [ ] Verificar almacenamiento en DB

**Página frontend:** `/dashboard/bom/[fileId]`

---

### 7.2 Ver BOM en Tabla 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Visualización tabular del BOM con filtros y ordenamiento.

**Columnas esperadas:**

- Categoría
- Familia
- Tipo
- Cantidad
- Unidad
- Área/Volumen (si aplica)

**Funcionalidades:**

- Ordenar por columna
- Filtrar por categoría
- Buscar por nombre
- Exportar a Excel

**Pruebas pendientes:**

- [ ] Ver BOM completo
- [ ] Ordenar por cantidad
- [ ] Filtrar por categoría
- [ ] Buscar elementos específicos

---

### 7.3 Exportar BOM a Excel 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Endpoint:** `GET /api/files/:id/bom/export`

**Formato de salida:** `.xlsx` (Excel)

**Pruebas pendientes:**

- [ ] Exportar BOM a Excel
- [ ] Verificar que archivo se descarga
- [ ] Verificar que datos son correctos
- [ ] Verificar formato y estilos

---

### 7.4 Comparar BOMs de Dos Versiones 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Compara BOMs de dos versiones del mismo archivo para detectar cambios.

**Cambios a detectar:**

- Elementos agregados
- Elementos eliminados
- Cantidades modificadas

**Pruebas pendientes:**

- [ ] Subir v1 y v2 del mismo archivo
- [ ] Extraer BOM de ambas
- [ ] Ejecutar comparación
- [ ] Verificar que detecta diferencias

---

### 7.5 BOM Agregado por Proyecto 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Agrega BOMs de todos los archivos de un proyecto para obtener totales.

**Pruebas pendientes:**

- [ ] Ver BOM agregado del proyecto
- [ ] Verificar que suma cantidades correctamente
- [ ] Exportar BOM agregado

---

## 8️⃣ CONVERSIÓN DE ARCHIVOS (Model Derivative)

### 8.1 Conversión Automática al Subir Archivo 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Al subir un archivo RVT/IFC, se inicia automáticamente el proceso de conversión a SVF para visualización.

**Servicio:** Autodesk Model Derivative API

**Flujo:**

1. Archivo se sube a OSS
2. Se inicia job de conversión a SVF
3. Job se crea en BullMQ para polling
4. Worker consulta periódicamente estado de conversión
5. Cuando termina, archivo queda listo para viewer

**Estados de conversión:**

- `PENDING`: Esperando inicio
- `IN_PROGRESS`: Convirtiendo
- `SUCCESS`: Completado
- `FAILED`: Error

**Pruebas pendientes:**

- [ ] Subir archivo RVT
- [ ] Verificar que conversión inicia automáticamente
- [ ] Verificar que job se crea en BullMQ
- [ ] Monitorear progreso hasta completar
- [ ] Verificar que URN se guarda en DB
- [ ] Probar abrir en viewer después de conversión

**Worker:** `conversionMdWorker` en `apps/api/src/jobs/workers/`

---

### 8.2 Conversión Manual (Retry) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Si una conversión falla, permite reintentarla manualmente.

**Endpoint:** `POST /api/files/:id/convert`

**Pruebas pendientes:**

- [ ] Simular conversión fallida
- [ ] Hacer clic en "Retry Conversion"
- [ ] Verificar que se reinicia job

---

### 8.3 Ver Progreso de Conversión 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Muestra barra de progreso o porcentaje mientras archivo se convierte.

**Fuente de datos:**

- APS Model Derivative API devuelve `progress: "50%"`
- Frontend actualiza UI basándose en Socket.io events

**Pruebas pendientes:**

- [ ] Subir archivo grande
- [ ] Verificar que progreso se actualiza en tiempo real
- [ ] Verificar que UI muestra spinner/loader

---

### 8.4 Conversión con Design Automation 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Conversión avanzada usando appbundle de Design Automation (para RVT → PDF personalizado).

**Configuración:** Requiere AppBundle desplegado en APS

**Pruebas pendientes:**

- [ ] Verificar que AppBundle está desplegado
- [ ] Ejecutar conversión DA
- [ ] Verificar que PDF se genera correctamente

---

### 8.5 Manejo de Errores de Conversión 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Errores comunes:**

- Archivo corrupto
- Formato no soportado
- Timeout de APS
- Falta de créditos APS

**Comportamiento esperado:**

- Logs claros del error
- Notificación al usuario
- Opción de reintentar

**Pruebas pendientes:**

- [ ] Subir archivo corrupto
- [ ] Verificar que error se captura
- [ ] Verificar mensaje de error al usuario
- [ ] Verificar que archivo queda marcado como FAILED

---

### 8.6 Conversión a Múltiples Formatos 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Formatos de salida:**

- SVF (para viewer)
- OBJ (exportación 3D)
- STEP (CAD exchange)
- PDF 2D (planos)

**Pruebas pendientes:**

- [ ] Convertir a SVF (ya está)
- [ ] Convertir a OBJ
- [ ] Descargar formato convertido

---

### 8.7 Cancelar Conversión en Progreso 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Permite cancelar una conversión que ya está corriendo.

**Pruebas pendientes:**

- [ ] Iniciar conversión
- [ ] Hacer clic en "Cancel"
- [ ] Verificar que job se cancela en BullMQ
- [ ] Verificar que APS job se detiene

---

## 9️⃣ ADMINISTRACIÓN

### 9.1 Panel de Admin - Ver Todos los Usuarios 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Endpoint:** `GET /api/admin/users`

**Permisos:** Solo ADMIN

**Datos a mostrar:**

- Lista de usuarios registrados
- Email
- Rol (ADMIN/USER)
- Fecha de registro
- Último login

**Pruebas pendientes:**

- [ ] Acceder como ADMIN
- [ ] Ver lista de usuarios
- [ ] Intentar acceder como USER (debe dar 403)

---

### 9.2 Cambiar Rol de Usuario (ADMIN → USER o viceversa) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Endpoint:** `PATCH /api/admin/users/:id/role`

**Body:**

```json
{
  "role": "ADMIN"
}
```

**Pruebas pendientes:**

- [ ] Cambiar usuario de USER a ADMIN
- [ ] Verificar que usuario obtiene permisos
- [ ] Cambiar de ADMIN a USER
- [ ] Verificar que pierde permisos

---

### 9.3 Ver Logs de Auditoría 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Ver registro de acciones importantes del sistema (logins, cambios de rol, eliminaciones).

**Pruebas pendientes:**

- [ ] Ver logs de auditoría
- [ ] Filtrar por usuario
- [ ] Filtrar por tipo de acción

---

### 9.4 Estadísticas Globales del Sistema 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Endpoint:** `GET /api/admin/status`

**Métricas esperadas:**

- Total usuarios
- Total proyectos
- Total archivos
- Total validaciones
- Almacenamiento usado

**Pruebas pendientes:**

- [ ] Ver stats como ADMIN
- [ ] Verificar que datos son correctos

---

### 9.5 Gestión de Configuración Global 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
Panel para modificar settings globales del sistema.

**Settings configurables:**

- Tamaño máximo de archivo
- Formatos permitidos
- Timeout de sesión

**Pruebas pendientes:**

- [ ] Modificar configuración
- [ ] Verificar que cambio se aplica
- [ ] Reiniciar sistema y verificar persistencia

---

### 9.6 Backup y Restauración 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Scripts para backup de base de datos PostgreSQL.

**Script:** `tools/scripts/backup-db.js`

**Pruebas pendientes:**

- [ ] Ejecutar backup manual
- [ ] Verificar que archivo .sql se genera
- [ ] Probar restauración desde backup
- [ ] Verificar que datos se recuperan correctamente

**Comandos:**

```bash
# Backup
npm run db:backup

# Restore
npm run db:restore -- backup-2026-04-14.sql
```

---

## 🔟 INTEGRACIÓN CON APS (Autodesk Platform Services)

### 10.1 Autenticación con APS (Client Credentials) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Backend obtiene tokens de APS usando Client ID y Client Secret.

**Grant type:** `client_credentials`

**Scopes requeridos:**

- `data:read`
- `data:write`
- `data:create`
- `bucket:read`
- `bucket:create`

**Pruebas pendientes:**

- [ ] Verificar que backend puede obtener token
- [ ] Verificar que token se usa en requests a APS
- [ ] Verificar manejo de expiración de token

**Archivos relevantes:**

- `apps/api/src/services/aps/auth.service.ts`

---

### 10.2 Gestión de Buckets OSS 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Autodesk Object Storage Service (OSS) almacena archivos BIM.

**Bucket configurado:** `dom-bim-platform-dev`

**Operaciones:**

- Crear bucket (si no existe)
- Subir archivo a bucket
- Generar signed URL para descarga
- Eliminar archivo de bucket

**Pruebas pendientes:**

- [ ] Verificar que bucket existe
- [ ] Crear bucket si no existe
- [ ] Subir archivo de prueba
- [ ] Descargar archivo con signed URL
- [ ] Eliminar archivo

---

### 10.3 Upload de Archivos a OSS 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Flujo:**

1. Usuario sube archivo al backend Express
2. Backend recibe multipart/form-data
3. Backend autentica con APS
4. Backend sube archivo a OSS usando `oss/v2/buckets/:bucket/objects/:objectKey`
5. Se obtiene URN del archivo
6. URN se almacena en DB

**Pruebas pendientes:**

- [ ] Subir archivo RVT pequeño
- [ ] Verificar que se almacena en OSS
- [ ] Verificar que URN se guarda en DB
- [ ] Subir archivo grande (chunked upload)

---

### 10.4 Model Derivative - Iniciar Conversión 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Endpoint APS:** `POST /modelderivative/v2/designdata/job`

**Body:**

```json
{
  "input": {
    "urn": "base64-encoded-urn"
  },
  "output": {
    "formats": [
      {
        "type": "svf",
        "views": ["2d", "3d"]
      }
    ]
  }
}
```

**Pruebas pendientes:**

- [ ] Iniciar conversión de RVT a SVF
- [ ] Verificar que job se acepta (200 OK)
- [ ] Obtener URN de salida (manifest)

---

### 10.5 Model Derivative - Consultar Estado (Manifest) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Endpoint APS:** `GET /modelderivative/v2/designdata/:urn/manifest`

**Respuesta incluye:**

- `status`: "pending", "inprogress", "success", "failed"
- `progress`: "50%"
- `derivatives`: archivos de salida generados

**Pruebas pendientes:**

- [ ] Consultar manifest de archivo en conversión
- [ ] Verificar que estado se actualiza
- [ ] Consultar manifest de archivo completado
- [ ] Manejar errores de conversión

---

### 10.6 Model Derivative - Descargar Propiedades 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Endpoint APS:** `GET /modelderivative/v2/designdata/:urn/metadata/:guid/properties`

**Uso:** Extracción de BOM y propiedades para validación

**Respuesta:**

- Array de objetos con:
  - `objectid`: ID del elemento
  - `name`: Nombre del elemento
  - `properties`: Diccionario de propiedades

**Pruebas pendientes:**

- [ ] Descargar propiedades de archivo convertido
- [ ] Verificar que se obtienen todas las categorías
- [ ] Parsear propiedades correctamente
- [ ] Almacenar propiedades en DB

---

### 10.7 Webhooks de APS 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
APS puede enviar webhooks cuando termina una conversión o sucede un evento.

**Endpoint backend:** `POST /api/webhooks/aps`

**Eventos esperados:**

- `extraction.finished` - Conversión completada
- `extraction.failed` - Conversión fallida

**Validación:**

- Header `x-ads-signature` debe validarse con `APS_WEBHOOK_SIGNING_SECRET`

**Pruebas pendientes:**

- [ ] Registrar webhook en APS
- [ ] Simular evento desde APS
- [ ] Verificar que backend recibe webhook
- [ ] Verificar validación de firma
- [ ] Verificar que worker se notifica del evento

---

### 10.8 Viewer - Obtener Token de 2-Legged 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Frontend necesita token APS para inicializar el Viewer.

**Endpoint:** `GET /api/aps/token`

**Respuesta:**

```json
{
  "access_token": "eyJ...",
  "expires_in": 3599
}
```

**Pruebas pendientes:**

- [ ] Obtener token desde frontend
- [ ] Verificar que token es válido
- [ ] Usar token para inicializar viewer

---

### 10.9 Viewer - Cargar Modelo en Navegador 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Frontend usa Autodesk Forge Viewer para renderizar el modelo.

**Script:** `https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js`

**Código esperado:**

```javascript
Autodesk.Viewing.Initializer(options, () => {
  const viewer = new Autodesk.Viewing.GuiViewer3D(container);
  viewer.start();
  Autodesk.Viewing.Document.load(urn, onDocumentLoadSuccess);
});
```

**Pruebas pendientes:**

- [ ] Verificar que script se carga
- [ ] Inicializar viewer con token
- [ ] Cargar URN del archivo
- [ ] Verificar que modelo se renderiza

---

### 10.10 Manejo de Creditos APS 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Descripción:**  
APS opera con sistema de créditos. Cada conversión consume créditos.

**Pruebas pendientes:**

- [ ] Consultar créditos disponibles
- [ ] Monitorear consumo
- [ ] Alertar si créditos son bajos

---

## 1️⃣1️⃣ WebSocket / Socket.io

### 11.1 Conexión Socket.io del Frontend 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Frontend establece conexión persistente con backend vía Socket.io.

**URL:** `ws://localhost:8080` (en desarrollo)

**Autenticación:** Cookies de sesión

**Pruebas pendientes:**

- [ ] Verificar que frontend conecta al cargar dashboard
- [ ] Verificar logs de conexión en backend
- [ ] Verificar que sesión se valida correctamente
- [ ] Probar reconexión automática si cae

**Archivos relevantes:**

- Backend: `apps/api/src/lib/socket.ts`
- Frontend: `apps/web/context/NotificationContext.tsx`

---

### 11.2 Emisión de Eventos desde Backend 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Backend emite eventos cuando sucede algo importante.

**Eventos implementados:**

- `notification:new` - Nueva notificación
- `validation:complete` - Validación terminada
- `file:converted` - Archivo convertido
- `worker:progress` - Progreso de job

**Pruebas pendientes:**

- [ ] Simular emisión de evento desde backend
- [ ] Verificar que frontend lo recibe
- [ ] Verificar que UI se actualiza

---

### 11.3 Recepción de Eventos en Frontend 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Descripción:**  
Frontend escucha eventos de Socket.io y actualiza UI.

**Ejemplo código:**

```javascript
socket.on("notification:new", (notification) => {
  // Agregar notificación al state
  // Mostrar toast
  // Actualizar contador
});
```

**Pruebas pendientes:**

- [ ] Verificar listeners activos
- [ ] Verificar que eventos se procesan
- [ ] Verificar que UI se actualiza sin refresh

---

### 11.4 Rooms por Usuario 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Cada usuario conectado se une a una "room" con su user ID.

**Uso:** Enviar eventos solo a usuarios específicos

**Código backend:**

```javascript
socket.join(`user:${userId}`);
io.to(`user:${userId}`).emit("notification:new", data);
```

**Pruebas pendientes:**

- [ ] Verificar que usuario se une a room
- [ ] Enviar evento a room específica
- [ ] Verificar que solo ese usuario lo recibe

---

## 1️⃣2️⃣ Workers y Jobs (BullMQ)

### 12.1 Worker de Conversión MD 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🔴 CRÍTICA

**Descripción:**  
Worker que procesa jobs de conversión de archivos usando APS Model Derivative.

**Queue:** `conversion-md`

**Concurrencia:** 8 jobs simultáneos

**Flujo:**

1. Job entra a queue
2. Worker toma job
3. Inicia conversión en APS
4. Hace polling cada 30s hasta completar
5. Actualiza estado en DB
6. Emite evento Socket.io

**Pruebas pendientes:**

- [ ] Crear job de conversión
- [ ] Verificar que worker lo procesa
- [ ] Verificar polling hasta completar
- [ ] Verificar actualización de DB
- [ ] Verificar emisión de evento

**Archivo:** `apps/api/src/jobs/workers/conversionMdWorker.ts`

---

### 12.2 Worker de Design Automation 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Queue:** `conversion-da`

**Concurrencia:** 5 jobs simultáneos

**Pruebas pendientes:**

- [ ] Verificar que worker está activo
- [ ] Crear job DA
- [ ] Monitorear procesamiento

---

### 12.3 Worker de Webhooks 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟡 ALTA

**Queue:** `webhooks`

**Descripción:**  
Procesa webhooks recibidos de APS de forma asíncrona.

**Flujo:**

1. Webhook llega a `/api/webhooks/aps`
2. Se valida firma
3. Se crea job en queue `webhooks`
4. Worker procesa webhook
5. Actualiza estado en DB según evento

**Pruebas pendientes:**

- [ ] Recibir webhook de APS
- [ ] Verificar que job se crea
- [ ] Verificar que worker lo procesa
- [ ] Verificar actualización correcta

---

### 12.4 Worker de DA Callbacks 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 BAJA

**Queue:** `da-callbacks`

**Descripción:**  
Procesa callbacks de Design Automation.

**Pruebas pendientes:**

- [ ] Verificar que worker está activo
- [ ] Procesar callback

---

### 12.5 Monitoreo de Queues (BullBoard) 🔍

**Estado:** 🔍 No testeado  
**Prioridad:** 🟢 MEDIA

**Descripción:**  
Dashboard web para monitorear queues y jobs de BullMQ.

**URL:** `http://localhost:8080/admin/queues` (si implementado)

**Funcionalidades:**

- Ver jobs activos
- Ver jobs completados/fallidos
- Reintentar jobs fallidos
- Ver logs de jobs

**Pruebas pendientes:**

- [ ] Acceder a BullBoard
- [ ] Ver queues activas
- [ ] Monitorear jobs en tiempo real

---

## 📈 MÉTRICAS Y PRIORIDADES

### Prioridades Sugeridas para Testing

#### 🔴 CRÍTICO (Testear YA)

1. **Login OAuth** ✅ - Ya validado
2. **Subir archivos**
3. **Listar proyectos**
4. **Crear proyecto**
5. **Conversión automática de archivos**
6. **Viewer 3D - Cargar modelo**
7. **Ejecutar validación manual**
8. **Ver resultados de validación**
9. **Extraer BOM**

#### 🟡 ALTO (Testear esta semana)

10. Sesión y refresh de tokens
11. Gestión de miembros de proyecto
12. Notificaciones in-app y Socket.io
13. Workers de conversión
14. Ver detalle de proyecto/archivo

#### 🟢 MEDIO/BAJO (Testear después)

- Exportaciones (Excel, PDF)
- Clash detection
- Backup/restore
- Hooks de APS
- BullBoard

---

## 📝 PLANTILLA PARA DOCUMENTAR RESULTADOS

Cuando pruebes cada funcionalidad, completa:

```markdown
### X.Y Nombre de Funcionalidad

**Estado:** ✅/⚠️/❌
**Fecha de prueba:** YYYY-MM-DD HH:MM
**Testeado por:** [Tu nombre]

**Resultado:**

- [x] Funcionalidad principal funciona
- [ ] Issue encontrado: [descripción]

**Errores encontrados:**

1. [Descripción del error]
   - **Log:** `[copiar log relevante]`
   - **Paso a reproducir:** ...
   - **Severidad:** CRÍTICO/ALTO/MEDIO/BAJO

**Cambios aplicados:**

- Archivo: `apps/...`
- Cambio: [descripción del fix]
- Commit: `abc123`

**Notas adicionales:**
[Cualquier observación importante]
```

---

## 🔄 PRÓXIMOS PASOS

1. **Revisar este documento** y familiarizarte con todas las funcionalidades
2. **Comenzar testing** en orden de prioridad (🔴 → 🟡 → 🟢)
3. **Documentar cada prueba** usando la plantilla
4. **Reportar errores** encontrados con logs y pasos de reproducción
5. **Aplicar fixes** según sea necesario
6. **Actualizar estado** de cada funcionalidad en este documento

---

## 📚 RECURSOS Y REFERENCIAS

### Documentación API

- Swagger UI: `http://localhost:8080/api-docs` (cuando esté disponible)
- Postman Collection: `/docs/DOM BIM-BIM-API.postman_collection.json` (si existe)

### Logs

- API logs: Terminal donde corre `npm run dev:api`
- Worker logs: Terminal donde corre `npm run dev:worker`
- Frontend logs: Browser DevTools Console (F12)

### Comandos Útiles

```bash
# Ver logs en tiempo real
tail -f /tmp/dom-bim-dev-*.log

# Health check
curl http://localhost:8080/health

# Ver estado de Redis
docker exec -it dom-bim-redis redis-cli KEYS "dom-bim:*"

# Ver jobs en BullMQ (desde Redis)
docker exec -it dom-bim-redis redis-cli KEYS "bull:*"

# Ver base de datos
docker exec -it dom-bim-db psql -U dom_bim -d dom_bim_platform -c "\dt"
```

---

**FIN DEL DOCUMENTO**

_Mantén este documento actualizado conforme avances en el testing. Es tu fuente única de verdad para el estado del proyecto._
