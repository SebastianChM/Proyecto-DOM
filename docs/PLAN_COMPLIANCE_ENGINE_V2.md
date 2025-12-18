# Plan de Implementación: Motor de Compliance Profesional

> **Inspirado en:** Solibri Model Checker, BIM Track, dRofus  
> **Fecha de creación:** 2025-12-10  
> **Estado:** ✅ APROBADO - EN DESARROLLO

---

## Resumen Ejecutivo

Implementar un sistema profesional de validación que compare especificaciones técnicas (ET) de documentos PDF/Excel contra modelos BIM (RVT), utilizando un motor de reglas configurable en lugar de parsing automático de texto.

---

## Arquitectura General

```
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                           │
├──────────────────────────────────────────────────────────────────┤
│  Rule Builder  │  Data Importer  │  Compliance Dashboard        │
│  (Crear reglas)│  (PDF/Excel)    │  (Resultados + 3D Viewer)    │
└───────┬────────┴────────┬────────┴────────────┬─────────────────┘
        │                 │                      │
        ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express)                           │
├──────────────────────────────────────────────────────────────────┤
│  Rule Engine   │  Table Extractor  │  Compliance Runner         │
│  (CRUD reglas) │  (tabula/camelot) │  (Ejecuta validación)      │
└───────┬────────┴────────┬──────────┴────────────┬───────────────┘
        │                 │                        │
        ▼                 ▼                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATABASE (Prisma)                           │
├──────────────────────────────────────────────────────────────────┤
│  Rule  │  Ruleset  │  DataSource  │  ComplianceRun  │  Issue    │
└────────┴───────────┴──────────────┴─────────────────┴───────────┘
```

---

## Hitos de Desarrollo

### HITO 1: Modelo de Datos y API de Reglas

**Duración estimada:** 2-3 días  
**Estado:** ✅ COMPLETADO (2025-12-10)

#### Objetivos

- Definir schema de base de datos para reglas y rulesets
- Crear API REST para CRUD de reglas
- Crear API para gestión de rulesets

#### Entregables

- [x] Schema Prisma: `Rule`, `Ruleset`, `DataSource`, `ComplianceRun`, `ComplianceIssue`
- [x] API: `POST/GET/PUT/DELETE /api/compliance-v2/rules`
- [x] API: `POST/GET/PUT/DELETE /api/compliance-v2/rulesets`
- [x] Seed con reglas de ejemplo (8 reglas en 2 rulesets)

#### Schema propuesto

```prisma
model Rule {
  id          String   @id @default(uuid())
  name        String   // "Cable Tray Width Check"
  description String?
  
  // Scope: Qué elementos aplica
  targetCategory    String   // "Cable Trays"
  targetNamePattern String?  // Regex opcional
  
  // Condición
  propertyName   String   // "Width"
  operator       String   // ">=", "<=", "==", "range", "exists"
  expectedValue  String   // "300"
  unit           String?  // "mm"
  tolerance      Float?   // 5 (±5mm)
  
  // Metadata
  severity       String   @default("WARNING") // "CRITICAL", "WARNING", "INFO"
  sourceDocument String?  // "ET Eléctrico Tabla 3.2"
  
  // Relations
  rulesetId  String?
  ruleset    Ruleset? @relation(fields: [rulesetId], references: [id])
  
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Ruleset {
  id          String  @id @default(uuid())
  name        String  // "Validación Eléctrica DOM"
  description String?
  discipline  String  // "ELECTRICAL", "STRUCTURAL", "MEP"
  
  rules       Rule[]
  projectId   String?
  
  createdAt   DateTime @default(now())
}
```

---

### HITO 2: Extractor de Datos Estructurados

**Duración estimada:** 2-3 días  
**Estado:** ✅ COMPLETADO (2025-12-10)

#### Objetivos

- Implementar extracción de tablas desde PDF
- Crear vista previa de datos extraídos
- Permitir importar desde Excel

#### Entregables

- [x] Servicio: `DataExtractorService` (usando `pdf-parse` + heurísticas)
- [x] API: `POST /api/data-sources/extract` (PDF → JSON)
- [x] API: `POST /api/data-sources/extract-from-file/:fileId`
- [x] Modelo: `DataSource` para almacenar datos extraídos
- [x] Lazy loading de xlsx para compatibilidad con monorepo

#### Schema propuesto

```prisma
model DataSource {
  id          String   @id @default(uuid())
  name        String   // "ET Eléctrico v1.0"
  type        String   // "PDF", "EXCEL"
  fileId      String?  // Referencia al archivo original
  
  // Datos estructurados extraídos
  extractedData Json   // { tables: [...], metadata: {...} }
  
  projectId   String
  createdAt   DateTime @default(now())
}
```

---

### HITO 3: UI de Creación de Reglas

**Duración estimada:** 2-3 días  
**Estado:** ✅ COMPLETADO (2025-12-10)

#### Objetivos

- Interfaz para crear/editar reglas individualmente
- Interfaz para gestionar rulesets
- Sugerencias basadas en datos extraídos

#### Entregables

- [ ] Componente: `RuleBuilder` (formulario de regla)
- [ ] Componente: `RulesetManager` (lista de reglas agrupadas)
- [ ] Componente: `RuleSuggestions` (sugerencias automáticas)
- [ ] Página: `/dashboard/compliance/rules`

#### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  Crear Nueva Regla                                      [X] │
├─────────────────────────────────────────────────────────────┤
│  Nombre: [Cable Tray Width Check          ]                 │
│                                                             │
│  ─── Alcance ───────────────────────────────────────────    │
│  Categoría Revit: [Cable Trays          ▼]                  │
│  Filtro de nombre: [^CT-.*              ] (regex opcional)  │
│                                                             │
│  ─── Condición ─────────────────────────────────────────    │
│  Propiedad: [Width                      ]                   │
│  Operador:  [>=  ▼]  Valor: [300]  Unidad: [mm]            │
│  Tolerancia: [±5] mm                                        │
│                                                             │
│  ─── Metadata ──────────────────────────────────────────    │
│  Severidad: (●) Crítico  ( ) Advertencia  ( ) Info         │
│  Fuente: [ET Eléctrico, Tabla 3.2       ]                   │
│                                                             │
│                              [Cancelar]  [Guardar Regla]    │
└─────────────────────────────────────────────────────────────┘
```

---

### HITO 4: Motor de Compliance v2

**Duración estimada:** 2-3 días  
**Estado:** ⬜ PENDIENTE

#### Objetivos

- Reescribir el motor para usar reglas de la DB
- Implementar comparación con tolerancias
- Generar incidencias detalladas

#### Entregables

- [ ] Servicio: `ComplianceRunnerService` (ejecuta ruleset contra modelo)
- [ ] API: `POST /api/compliance/run` (ejecutar validación)
- [ ] Modelo: `ComplianceRun` (historial de ejecuciones)
- [ ] Modelo: `ComplianceIssue` (incidencias encontradas)

#### Schema propuesto

```prisma
model ComplianceRun {
  id          String   @id @default(uuid())
  status      String   // "RUNNING", "COMPLETED", "FAILED"
  
  // Inputs
  modelUrn    String   // URN del modelo RVT
  rulesetId   String
  ruleset     Ruleset  @relation(fields: [rulesetId], references: [id])
  
  // Results
  totalElements Int?
  totalRules    Int?
  passedCount   Int?
  failedCount   Int?
  
  issues      ComplianceIssue[]
  
  startedAt   DateTime @default(now())
  completedAt DateTime?
  projectId   String
}

model ComplianceIssue {
  id          String   @id @default(uuid())
  
  // Contexto
  runId       String
  run         ComplianceRun @relation(fields: [runId], references: [id])
  ruleId      String
  
  // Elemento afectado
  elementId   Int      // Revit Element ID
  elementName String
  elementCategory String
  
  // Detalles
  propertyName  String
  expectedValue String
  actualValue   String
  deviation     Float?   // Porcentaje de desviación
  
  severity    String   // "CRITICAL", "WARNING"
  status      String   @default("OPEN") // "OPEN", "RESOLVED", "IGNORED"
  
  createdAt   DateTime @default(now())
}
```

---

### HITO 5: Dashboard de Resultados

**Duración estimada:** 2-3 días  
**Estado:** ⬜ PENDIENTE

#### Objetivos

- Dashboard con resumen visual de cumplimiento
- Lista de incidencias con filtros
- Integración con visor 3D para navegación

#### Entregables

- [ ] Componente: `ComplianceDashboard` (resumen visual)
- [ ] Componente: `IssuesList` (tabla de incidencias)
- [ ] Componente: `IssueDetail` (detalle con link a 3D)
- [ ] Integración: Click en issue → highlight en visor 3D
- [ ] Página: `/dashboard/compliance/results/[runId]`

#### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  Resultados de Validación - ET Eléctrico v1.0               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  ✅ 847  │  │  ⚠️ 23   │  │  ❌ 5    │  │  📊 95%  │    │
│  │ Pasaron  │  │ Warnings │  │ Críticos │  │ Cumplim. │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Por Categoría:                                             │
│  ████████████████████░░░░ Cable Trays      85%              │
│  ██████████████████████░░ Conduits         92%              │
│  ████████████████████████ Lighting         100%             │
├─────────────────────────────────────────────────────────────┤
│  Incidencias:                          [Filtrar ▼] [Export] │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ❌ CT-001 Width < Minimum   Esperado: ≥300mm Act: 250 │  │
│  │ ⚠️ CT-045 Height Mismatch   Esperado: 100mm Act: 95   │  │
│  │ ❌ LUM-12 Power Rating      Esperado: ≥60W Act: 45W   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

### HITO 6: Integración y Pulido

**Duración estimada:** 2 días  
**Estado:** ⬜ PENDIENTE

#### Objetivos

- Integrar todos los componentes en flujo completo
- Exportar resultados a Excel/PDF
- Documentación de uso

#### Entregables

- [ ] Flujo completo: Upload PDF → Crear Reglas → Ejecutar → Resultados
- [ ] Exportación a Excel con formato profesional
- [ ] Exportación a PDF con logo y formato
- [ ] Guía de usuario básica

---

## Cronograma Estimado

| Hito | Descripción | Días | Acumulado |
|------|-------------|------|-----------|
| 1 | Modelo de Datos y API | 2-3 | 3 |
| 2 | Extractor de Datos | 2-3 | 6 |
| 3 | UI de Reglas | 2-3 | 9 |
| 4 | Motor de Compliance v2 | 2-3 | 12 |
| 5 | Dashboard de Resultados | 2-3 | 15 |
| 6 | Integración y Pulido | 2 | 17 |

**Total estimado:** 15-17 días de desarrollo

---

## Registro de Progreso

| Fecha | Hito | Estado | Notas |
|-------|------|--------|-------|
| 2025-12-10 | 1 | ✅ Completado | Schema Prisma, API CRUD, Seed ejecutado |
| 2025-12-10 | 2 | ✅ Completado | DataExtractorService, API data-sources |
| 2025-12-10 | 3 | ✅ Completado | RuleBuilder, RulesetManager, /dashboard/compliance/rules |
| 2025-12-10 | 4 | ✅ Completado | ComplianceRunnerService, API /runs/demo 88% score |

---

## Aprobación

- [x] Plan revisado y aprobado por el usuario
- [x] Fecha de inicio confirmada: 2025-12-10
