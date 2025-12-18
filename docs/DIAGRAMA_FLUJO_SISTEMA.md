# 🔄 Diagrama de Flujo del Sistema

## Escenario Completo: Primera Validación + Modificación Automática

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          USUARIO EN CUALQUIER PÁGINA                         │
│                         (Projects, Files, Settings...)                       │
└────────────────────────┬─────────────────────────────────────────────────────┘
                         │
                         │ 🔔 Campana de Notificaciones
                         │    Siempre Visible (top-right)
                         │    Badge: "3" no leídas
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD LAYOUT (Global)                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │  <UserProvider>                                                │         │
│  │    <NotificationProvider userId={user.id}>                     │         │
│  │      <NotificationBell />  ← Campana global fija               │         │
│  │      {children}            ← Contenido de cada página          │         │
│  │    </NotificationProvider>                                     │         │
│  │  </UserProvider>                                               │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  • NotificationContext hace polling cada 30s                                │
│  • Mantiene estado global de notificaciones                                 │
│  • Sincroniza con backend /api/notifications                                │
└──────────────────────────────────────────────────────────────────────────────┘
                         │
                         │ Usuario navega a
                         │ Structure Validation
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PÁGINA DE VALIDACIÓN                                 │
│                                                                              │
│  1. Selecciona proyecto y archivo                                           │
│  2. Upload Engineering Table (Excel)                                        │
│  3. Click "Run Validation"                                                  │
│                                                                              │
│  Frontend envía:                                                            │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ POST /api/validation-runner/run                            │             │
│  │ {                                                          │             │
│  │   fileId: "file-uuid",                                     │             │
│  │   fileName: "Torre-Reforma.rvt",                           │             │
│  │   userId: "user-uuid",                                     │             │
│  │   projectId: "project-uuid",                               │             │
│  │   etData: [ /* Engineering Table */ ],                     │             │
│  │   modelData: [ /* 3D Model Data */ ]                       │             │
│  │ }                                                          │             │
│  └────────────────────────────────────────────────────────────┘             │
└────────────────────────┬─────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND - validation-runner.ts                            │
│                                                                              │
│  FASE 1: CREAR VALIDACIÓN                                                   │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │ ValidationRun.create()                                   │               │
│  │ - Status: PROCESSING                                     │               │
│  │ - Timestamp: 2025-12-01 10:30:00                         │               │
│  └──────────────────────────────────────────────────────────┘               │
│                         │                                                    │
│                         ▼                                                    │
│  FASE 2: EJECUTAR LÓGICA DE VALIDACIÓN                                      │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │ Comparar etData vs modelData:                            │               │
│  │                                                          │               │
│  │ Issues encontrados:                                      │               │
│  │  • FV-101: MISMATCH (Ball vs Gate Valve)                │               │
│  │  • P-205: MISSING (en ET, no en modelo)                 │               │
│  │  • EXTRA-001: UNDOCUMENTED (en modelo, no en ET)        │               │
│  └──────────────────────────────────────────────────────────┘               │
│                         │                                                    │
│                         ▼                                                    │
│  FASE 3: GUARDAR ISSUES EN DB                                               │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │ ValidationIssue.createMany([                             │               │
│  │   {                                                      │               │
│  │     type: "MISMATCH",                                    │               │
│  │     severity: "MEDIUM",                                  │               │
│  │     elementTag: "FV-101",                                │               │
│  │     message: "Type mismatch...",                         │               │
│  │     expectedValue: "Ball Valve",                         │               │
│  │     actualValue: "Gate Valve"                            │               │
│  │   },                                                     │               │
│  │   { type: "MISSING", ... },                              │               │
│  │   { type: "UNDOCUMENTED", ... }                          │               │
│  │ ])                                                       │               │
│  └──────────────────────────────────────────────────────────┘               │
│                         │                                                    │
│                         ▼                                                    │
│  FASE 4: ACTUALIZAR VALIDACIÓN                                              │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │ ValidationRun.update()                                   │               │
│  │ - Status: COMPLETED                                      │               │
│  │ - missingCount: 1                                        │               │
│  │ - mismatchCount: 1                                       │               │
│  │ - undocumentedCount: 1                                   │               │
│  │ - completedAt: 2025-12-01 10:32:15                       │               │
│  └──────────────────────────────────────────────────────────┘               │
│                         │                                                    │
│                         ▼                                                    │
│  FASE 5: CREAR NOTIFICACIONES                                               │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │ createValidationNotifications()                          │               │
│  │                                                          │               │
│  │ Notification 1: VALIDATION_COMPLETE                      │               │
│  │ - Title: "Validation Complete"                           │               │
│  │ - Message: "Found 3 issues: 1 missing, 1..."            │               │
│  │ - Priority: NORMAL                                       │               │
│  │                                                          │               │
│  │ Notification 2: ISSUE_CREATED (si severity HIGH/CRITICAL)│               │
│  │ - Title: "MEDIUM Issue Found"                            │               │
│  │ - Message: "MISMATCH: FV-101..."                         │               │
│  │ - Priority: NORMAL                                       │               │
│  └──────────────────────────────────────────────────────────┘               │
│                         │                                                    │
│                         ▼                                                    │
│  FASE 6: DETECCIÓN AUTOMÁTICA DE CAMBIOS                                    │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │ detectAndNotifyChanges()                                 │               │
│  │                                                          │               │
│  │ ¿Hay validación anterior del mismo archivo?             │               │
│  │ → NO: Primera validación, skip                           │               │
│  └──────────────────────────────────────────────────────────┘               │
└────────────────────────┬─────────────────────────────────────────────────────┘
                         │
                         │ Response 200 OK
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                              │
│  • Recibe resultado de validación                                           │
│  • Muestra toast: "Validation Complete: 3 issues found"                     │
│  • NotificationContext hace fetch automático                                │
│  • Badge en campana se actualiza: "3" → badge rojo pulsante                 │
│  • Usuario ve campana con badge rojo                                        │
└──────────────────────────────────────────────────────────────────────────────┘
                         │
                         │ Usuario modifica archivo
                         │ y ejecuta validación de nuevo
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SEGUNDA VALIDACIÓN (ARCHIVO MODIFICADO)                   │
│                                                                              │
│  Usuario ejecuta validación nuevamente con datos actualizados               │
│  Frontend envía POST /api/validation-runner/run                             │
└────────────────────────┬─────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND - validation-runner.ts                            │
│                                                                              │
│  FASES 1-5: Igual que antes, crea nueva ValidationRun + Issues              │
│                                                                              │
│  Nuevos resultados:                                                         │
│  • P-205: Ahora SÍ está en el modelo (RESUELTO!)                            │
│  • FV-101: Sigue siendo MISMATCH                                            │
│  • EXTRA-001: Sigue UNDOCUMENTED                                            │
│  • NEW-500: NUEVO elemento sin documentar                                   │
│                                                                              │
│                         │                                                    │
│                         ▼                                                    │
│  FASE 6: DETECCIÓN AUTOMÁTICA DE CAMBIOS ⚡                                  │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │ detectAndNotifyChanges()                                 │               │
│  │                                                          │               │
│  │ Busca validaciones anteriores:                           │               │
│  │ ✓ Encontrada: ValidationRun de hace 5 minutos            │               │
│  │                                                          │               │
│  │ Compara issues por elementTag:                           │               │
│  │                                                          │               │
│  │ NUEVOS ISSUES:                                           │               │
│  │  • NEW-500 (no estaba antes)                             │               │
│  │                                                          │               │
│  │ ISSUES RESUELTOS:                                        │               │
│  │  • P-205 (estaba MISSING, ahora OK)                      │               │
│  │                                                          │               │
│  │ CAMBIOS EN CONTADORES:                                   │               │
│  │  • Missing: 1 → 0 (↓1)                                   │               │
│  │  • Undocumented: 1 → 2 (↑1)                              │               │
│  │                                                          │               │
│  │ ✅ CREAR NOTIFICACIÓN FILE_CHANGED:                      │               │
│  │    Title: "File Updated - Changes Detected"             │               │
│  │    Message: "Changes detected: 1 new issue,             │               │
│  │              1 resolved. Missing: -1, Undoc: +1"         │               │
│  │    Priority: NORMAL                                      │               │
│  │    Metadata: {                                           │               │
│  │      newIssues: [{tag: "NEW-500", type: "UNDOC"}],      │               │
│  │      resolvedIssues: [{tag: "P-205", type: "MISSING"}]  │               │
│  │    }                                                     │               │
│  └──────────────────────────────────────────────────────────┘               │
└────────────────────────┬─────────────────────────────────────────────────────┘
                         │
                         │ Response 200 OK
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                              │
│  • NotificationContext recibe nueva notificación en próximo polling          │
│  • Badge actualiza: "3" → "4" (nueva notificación FILE_CHANGED)             │
│  • Usuario click en campana:                                                │
│                                                                              │
│    ┌──────────────────────────────────────────────────────┐                 │
│    │ 🔔 Notifications          [3 unread] [×]             │                 │
│    ├──────────────────────────────────────────────────────┤                 │
│    │ 🔵 FILE CHANGED              2m ago                  │                 │
│    │    File Updated - Changes Detected                   │                 │
│    │    Changes detected: 1 new, 1 resolved               │                 │
│    │    📄 Torre-Reforma.rvt                              │                 │
│    ├──────────────────────────────────────────────────────┤                 │
│    │ ✅ VALIDATION COMPLETE       5m ago                  │                 │
│    │    Validation Complete                               │                 │
│    │    Found 3 issues: 1 missing, 1 mismatch...          │                 │
│    │    📄 Torre-Reforma.rvt                              │                 │
│    ├──────────────────────────────────────────────────────┤                 │
│    │ ⚠️  ISSUE CREATED            5m ago                  │                 │
│    │    MEDIUM Issue Found                                │                 │
│    │    MISMATCH: FV-101 type differs                     │                 │
│    └──────────────────────────────────────────────────────┘                 │
│                                                                              │
│  • Usuario ve claramente qué cambió                                         │
│  • Puede comparar validaciones con GET /api/validations/compare/:id1/:id2   │
│  • Puede ver detalles con GET /api/validations/:id                          │
└──────────────────────────────────────────────────────────────────────────────┘
                         │
                         │ Usuario navega a otra página
                         │ (Projects, Files, etc.)
                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       CUALQUIER OTRA PÁGINA                                  │
│                                                                              │
│  🔔 Campana SIGUE VISIBLE (top-right)                                       │
│     Badge: "4" no leídas                                                    │
│                                                                              │
│  • Notificaciones persisten en DB                                           │
│  • Context mantiene estado sincronizado                                     │
│  • Usuario puede ver notificaciones desde cualquier lugar                   │
│  • Click → Panel se abre con historial completo                             │
└──────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

RESUMEN DE FLUJO:

1. PRIMERA VALIDACIÓN:
   ✓ Crea ValidationRun
   ✓ Detecta issues → ValidationIssue
   ✓ Genera notificaciones automáticas
   ✓ Usuario ve badge rojo en campana

2. ARCHIVO MODIFICADO:
   ✓ Nueva validación ejecutada
   ✓ Sistema AUTOMÁTICAMENTE compara con anterior
   ✓ Detecta cambios (nuevos, resueltos, modificados)
   ✓ Crea notificación FILE_CHANGED
   ✓ Usuario informado de diferencias

3. NOTIFICACIONES GLOBALES:
   ✓ Visibles en TODAS las páginas
   ✓ Persistentes en base de datos
   ✓ Sincronización automática cada 30s
   ✓ Interacción completa (read, delete, clear)

═══════════════════════════════════════════════════════════════════════════════
```

## 🎯 Ventajas del Sistema

### Para Usuarios:
- ✅ **Nunca pierden información**: Todo guardado en DB
- ✅ **Siempre informados**: Notificaciones en todas las páginas
- ✅ **Detectan cambios automáticamente**: Sin comparación manual
- ✅ **Historial completo**: Pueden revisar validaciones pasadas

### Para Desarrolladores:
- ✅ **API REST completa**: Endpoints para todo
- ✅ **Context global**: Estado sincronizado en React
- ✅ **Extensible**: Fácil agregar nuevos tipos de notificaciones
- ✅ **Escalable**: Preparado para múltiples usuarios y proyectos

### Para el Proyecto:
- ✅ **Profesional**: Sistema robusto tipo enterprise
- ✅ **Trazable**: Todo tiene timestamp y autor
- ✅ **Auditable**: Historial completo de cambios
- ✅ **Mantenible**: Código limpio y documentado
