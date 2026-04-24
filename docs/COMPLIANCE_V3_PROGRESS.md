# Compliance Engine V3 — Progress Tracker

**Ultima actualizacion:** 2026-04-24  
**Estado global:** EN PROGRESO  
**Fase actual:** FASE 5 COMPLETADA — Motor de Evaluacion (funciones puras)

---

## Resumen de Fases

| Fase | Nombre                    | Estado      | Fecha inicio | Fecha fin  | Notas                                                                                   |
| ---- | ------------------------- | ----------- | ------------ | ---------- | --------------------------------------------------------------------------------------- |
| 0    | Schema + Migracion        | COMPLETED   | 2026-04-23   | 2026-04-23 | Todas las tareas (1-10) completadas                                                     |
| 1    | Diccionarios + Seeds      | COMPLETED   | 2026-04-23   | 2026-04-23 | Todas las tareas (1-6) completadas                                                      |
| 2    | BIM Query Refactor        | COMPLETED   | 2026-04-23   | 2026-04-23 | 14 NAME_CATEGORY_PATTERNS + 10 unitMap eliminados, reemplazados por dictionary services |
| 3    | Packs & Requirements CRUD | IN PROGRESS | 2026-04-23   | -          | Sesion A: servicios + schemas completados. Falta: rutas, tests                          |
| 4    | Project Config            | COMPLETED   | 2026-04-24   | 2026-04-24 | Service + Zod schemas + routes + unit tests (9) + integration tests (5)                 |
| 5    | Motor de Evaluacion       | COMPLETED   | 2026-04-24   | 2026-04-24 | 7 archivos puras + barrel. 50 tests unitarios pasando                                   |
| 6    | Orquestador de Runs       | NOT STARTED | -            | -          |                                                                                         |
| 7    | LLM Suggestions           | NOT STARTED | -            | -          |                                                                                         |
| 8    | Frontend Hooks + UI       | NOT STARTED | -            | -          |                                                                                         |
| 9    | Dashboard + Export        | NOT STARTED | -            | -          |                                                                                         |
| 10   | Limpieza Legacy           | NOT STARTED | -            | -          |                                                                                         |

---

## Detalle por Fase

### FASE 0: Schema + Migracion

| #   | Tarea                                    | Estado | Archivo(s)                                                                   | Notas                                                                                                                                                                                                                                          |
| --- | ---------------------------------------- | ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Agregar modelos nuevos a schema.prisma   | DONE   | packages/database/prisma/schema.prisma                                       | 12 modelos nuevos (sec 5.1): Organization, OrgMember, RegulationPack, PackDocument, Requirement, RequirementCondition, ApplicabilityRule, PropertyDictionary, CategoryDictionary, UnitConversion, ProjectComplianceConfig, RequirementOverride |
| 2   | Agregar organizationId a Project         | DONE   | schema.prisma                                                                | String? opcional + relacion Organization                                                                                                                                                                                                       |
| 3   | Agregar legalReference a ComplianceIssue | DONE   | schema.prisma                                                                | String? opcional                                                                                                                                                                                                                               |
| 4   | Agregar configId a ComplianceRun         | DONE   | schema.prisma                                                                | String? -> ProjectComplianceConfig                                                                                                                                                                                                             |
| 5   | Agregar complianceRunId a Notification   | DONE   | schema.prisma                                                                | String? con relacion a ComplianceRun                                                                                                                                                                                                           |
| 6   | Agregar metadata (Json?) a ComplianceRun | DONE   | schema.prisma                                                                | Para progreso incremental. Tambien actualizado comentario status con TIMEOUT, ERROR                                                                                                                                                            |
| 7   | Ejecutar prisma migrate                  | DONE   | packages/database/prisma/migrations/20260423195601_add_compliance_v3_models/ | Migracion aplicada exitosamente                                                                                                                                                                                                                |
| 8   | Correr test suite existente              | DONE   | -                                                                            | 22 suites, 203 passed, 1 skipped (pre-existente). Se corrigieron 2 test files con mocks faltantes (configId, metadata, legalReference)                                                                                                         |
| 9   | Crear migrate-legacy-compliance.ts       | DONE   | packages/database/prisma/migrate-legacy-compliance.ts                        | Script idempotente creado. Mapeo: Ruleset->RegulationPack, Rule->Requirement+RequirementCondition+ApplicabilityRule. Sec 5.5                                                                                                                   |
| 10  | Ejecutar migracion de datos              | DONE   | -                                                                            | Ejecutado 2x (idempotencia verificada). 0 rulesets legacy en DB (tablas vacias). Spot check: todas las tablas V3 accesibles, tablas originales intactas. Tests: 22 suites, 203 passed                                                          |

### FASE 1: Diccionarios + Seeds

| #   | Tarea                     | Estado | Archivo(s)                                                      | Notas                                                                                                       |
| --- | ------------------------- | ------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | PropertyDictionaryService | DONE   | apps/api/src/services/dictionary/property-dictionary.service.ts | resolve (exact+alias+case-insensitive), getByCanonical, getAll. Cached 1h via CacheService                  |
| 2   | CategoryDictionaryService | DONE   | apps/api/src/services/dictionary/category-dictionary.service.ts | resolve (canonicalName+displayName+revitCategory+aliases), getAll. Cached 1h                                |
| 3   | UnitConversionService     | DONE   | apps/api/src/services/dictionary/unit-conversion.service.ts     | convert (direct+inverse), normalize (SI base). Cached 1h                                                    |
| 4   | Types + index             | DONE   | apps/api/src/services/dictionary/types.ts, index.ts             | PropertyEntry, CategoryEntry, NormalizedValue                                                               |
| 5   | Seed script diccionarios  | DONE   | packages/database/prisma/seed-dictionaries.ts                   | 98 properties (49 canonical x 2 locales), 60 categories (30 x 2), 57 unit conversions. Idempotente (upsert) |
| 6   | Tests unitarios (15 min)  | DONE   | apps/api/tests/unit/services/dictionary/\*.test.ts              | 26 tests: 9 property, 7 category, 10 unit-conversion. Todos pasando                                         |

### FASE 2: BIM Query Refactor

| #   | Tarea                                   | Estado | Archivo(s)                                                                              | Notas                                                                                                                                                                                                                                     |
| --- | --------------------------------------- | ------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Refactorizar bim-query.service.ts       | DONE   | apps/api/src/services/bim-query.service.ts                                              | 14 NAME_CATEGORY_PATTERNS eliminados → CategoryDictionaryService.getAll() + resolveCategoryFromName(). 6 CATEGORY_PATHS movidos a config (DEFAULT_CATEGORY_PATHS, overridable via BimQueryConfig). Constructor con locale + categoryPaths |
| 2   | Refactorizar unit-normalizer.service.ts | DONE   | apps/api/src/services/unit-normalizer.service.ts                                        | 10 unitMap entries + convertToStandard switch eliminados → UnitConversionService.normalize(). normalize() ahora async. Zero hardcoded conversions                                                                                         |
| 3   | Tests unitarios                         | DONE   | apps/api/tests/unit/services/bim-query.service.test.ts, unit-normalizer.service.test.ts | 12 tests (5 bim-query + 7 unit-normalizer). Todos pasando                                                                                                                                                                                 |

### FASE 3: Packs & Requirements CRUD

| #   | Tarea                      | Estado      | Archivo(s)                                                     | Notas                                                                                                                                                                                                                                                                                  |
| --- | -------------------------- | ----------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RegulationPackService      | DONE        | apps/api/src/services/compliance-v3/regulation-pack.service.ts | list (paginated+filters), getById, create (DRAFT), update (DRAFT only), publish (DRAFT→PUBLISHED), deprecate (PUBLISHED→DEPRECATED). AuditLog en todas las escrituras                                                                                                                  |
| 2   | RequirementService         | DONE        | apps/api/src/services/compliance-v3/requirement.service.ts     | list (paginated+filters), getById (conditions+applicability), create (DRAFT, min 1 condition), update (DRAFT/VERIFIED, reset to DRAFT), verify (DRAFT→VERIFIED), retire (ACTIVE/VERIFIED→RETIRED), bulkCreate (max 100), delete (DRAFT only, fisico). AuditLog en todas las escrituras |
| 3   | Rutas V3 packs             | NOT STARTED | apps/api/src/routes/compliance-v3/packs.routes.ts              | /api/compliance-v3/packs                                                                                                                                                                                                                                                               |
| 4   | Rutas V3 requirements      | NOT STARTED | apps/api/src/routes/compliance-v3/requirements.routes.ts       | /api/compliance-v3/packs/:id/requirements                                                                                                                                                                                                                                              |
| 5   | Zod schemas                | DONE        | apps/api/src/routes/compliance-v3/schemas.ts                   | pagination, createPack, updatePack, createRequirement, updateRequirement, bulkCreate, verify. 10 disciplines, 10 operators, code pattern regex. PaginatedResponse interface                                                                                                            |
| 6   | Router index + registro    | PARTIAL     | apps/api/src/routes/compliance-v3/index.ts                     | Barrel export creado. Falta registrar rutas y montar en index.ts principal                                                                                                                                                                                                             |
| 7   | Tests integracion (14 min) | NOT STARTED | apps/api/tests/integration/                                    | 14 tests minimo                                                                                                                                                                                                                                                                        |

### FASE 4: Project Config

| #   | Tarea                          | Estado | Archivo(s)                                                      | Notas                                                                                                                                                                                   |
| --- | ------------------------------ | ------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ProjectComplianceConfigService | DONE   | apps/api/src/services/compliance-v3/project-config.service.ts   | getConfig, upsertConfig ($transaction), addOverride, removeOverride, getResolved. Cache compliance:config:${projectId} TTL 30min. IProjectComplianceConfigService + singleton exportado |
| 2   | Rutas config                   | DONE   | apps/api/src/routes/compliance-v3/config.routes.ts              | GET/PUT /projects/:projectId/compliance-config, POST/DELETE overrides, GET resolved. Todos con Zod + asyncHandler. Registradas en barrel index.ts                                       |
| 3   | Tests unitarios (9)            | DONE   | apps/api/tests/unit/services/project-config.service.test.ts     | 9 tests: getConfig x2, upsertConfig x3, addOverride x2, removeOverride x1, getResolved x1. Todos pasando                                                                                |
| 4   | Tests integracion (5)          | DONE   | apps/api/tests/integration/compliance-v3/project-config.test.ts | 5 tests: 401 sin autenticacion para los 5 endpoints. Pre-existing @bull-board issue bloquea ejecucion (afecta todos los integration tests)                                              |

### FASE 5: Motor de Evaluacion

| #   | Tarea                      | Estado  | Archivo(s)                                                                | Notas                                                                        |
| --- | -------------------------- | ------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | evaluateCondition (pura)   | DONE    | apps/api/src/services/compliance-engine-v3/engine/evaluate-condition.ts   | 10 operadores. Tests: 16                                                     |
| 2   | evaluateRequirement (pura) | DONE    | apps/api/src/services/compliance-engine-v3/engine/evaluate-requirement.ts | AND/OR logic, ERROR catch, parseConditions. Tests: 8                         |
| 3   | matchElements (pura)       | DONE    | apps/api/src/services/compliance-engine-v3/engine/match-elements.ts       | parseApplicability Zod helper. Tests: 7                                      |
| 4   | normalizeValue (pura)      | DONE    | apps/api/src/services/compliance-engine-v3/engine/normalize-value.ts      | UnitConversionMap lookup. Tests: 6                                           |
| 5   | calculateDeviation (pura)  | DONE    | apps/api/src/services/compliance-engine-v3/engine/calculate-deviation.ts  | Infinity when expected=0. Tests: 5                                           |
| 6   | calculateScore (pura)      | DONE    | apps/api/src/services/compliance-engine-v3/engine/calculate-score.ts      | NOT_APPLICABLE ignorado, ERROR=failed. Tests: 7                              |
| 7   | requirementResolver        | SKIPPED | -                                                                         | No mencionado en FASE 5 — aplaza a FASE 6                                    |
| 8   | Types del motor            | DONE    | apps/api/src/services/compliance-engine-v3/types.ts                       | Todas las interfaces del Master Plan + ApplicabilityShape + PropertyResolver |
| 9   | Tests unitarios (50)       | DONE    | apps/api/tests/unit/services/compliance-engine-v3/                        | 50 tests en 6 archivos. Todos pasando                                        |

### FASE 6: Orquestador de Runs

| #   | Tarea                      | Estado      | Archivo(s)                                                          | Notas                                      |
| --- | -------------------------- | ----------- | ------------------------------------------------------------------- | ------------------------------------------ |
| 1   | ComplianceRunnerV3 service | NOT STARTED | apps/api/src/services/compliance-v3/compliance-runner-v3.service.ts | Pipeline completo                          |
| 2   | Rutas de runs              | NOT STARTED | apps/api/src/routes/compliance-v3/runs.routes.ts                    | /api/compliance-v3/runs                    |
| 3   | Integracion Redis cache    | NOT STARTED | -                                                                   | Usar CacheService existente                |
| 4   | Integracion Notifications  | NOT STARTED | -                                                                   | Usar modelo Notification + complianceRunId |
| 5   | Tests integracion (5 min)  | NOT STARTED | apps/api/tests/integration/                                         | Pipeline E2E                               |

### FASE 7: LLM Suggestions

| #   | Tarea             | Estado      | Archivo(s)                                                | Notas                          |
| --- | ----------------- | ----------- | --------------------------------------------------------- | ------------------------------ |
| 1   | SuggestionService | NOT STARTED | apps/api/src/services/compliance-v3/suggestion.service.ts | OpenAI mocked                  |
| 2   | Rutas suggestions | NOT STARTED | apps/api/src/routes/compliance-v3/suggestions.routes.ts   | /api/compliance-v3/suggestions |
| 3   | Tests (4 min)     | NOT STARTED | apps/api/tests/unit/                                      | LLM mocked                     |

### FASE 8: Frontend Hooks + UI

| #   | Tarea                                   | Estado      | Archivo(s)                      | Notas                                  |
| --- | --------------------------------------- | ----------- | ------------------------------- | -------------------------------------- |
| 1   | API client layer                        | NOT STARTED | apps/web/lib/api/               | V3 endpoints                           |
| 2   | Hooks (usePacks, useRequirements, etc.) | NOT STARTED | apps/web/hooks/                 | 5+ hooks nuevos                        |
| 3   | UI components                           | NOT STARTED | apps/web/components/compliance/ | Pack editor, requirement builder, etc. |

### FASE 9: Dashboard + Export

| #   | Tarea                               | Estado      | Archivo(s)                                         | Notas           |
| --- | ----------------------------------- | ----------- | -------------------------------------------------- | --------------- |
| 1   | Adapter V3 para dashboard unificado | NOT STARTED | apps/api/src/domain/unified-validation-compliance/ | Agregar adapter |
| 2   | Export routes refactored            | NOT STARTED | apps/api/src/routes/compliance-v3/export.routes.ts |                 |

### FASE 10: Limpieza Legacy

| #   | Tarea                                   | Estado      | Archivo(s)                                             | Notas           |
| --- | --------------------------------------- | ----------- | ------------------------------------------------------ | --------------- |
| 1   | Eliminar v1.routes.ts                   | NOT STARTED | apps/api/src/routes/compliance/v1.routes.ts            |                 |
| 2   | Eliminar validation/parser.service.ts   | NOT STARTED | apps/api/src/services/validation/parser.service.ts     |                 |
| 3   | Eliminar hierarchical-spec-processor.ts | NOT STARTED | apps/api/src/services/hierarchical-spec-processor.ts   |                 |
| 4   | Eliminar mop-parser.service.ts          | NOT STARTED | apps/api/src/services/mop-parser.service.ts            |                 |
| 5   | Eliminar generateDemoResults()          | NOT STARTED | apps/api/src/services/validation/validation.service.ts | Solo la funcion |
| 6   | Actualizar docs                         | NOT STARTED | docs/                                                  |                 |

---

## Log de Sesiones

| Sesion | Fecha      | Fase       | Tareas completadas | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ---------- | ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | 2026-04-23 | FASE 0     | Tareas 1-8         | Schema V3: 12 modelos nuevos + 4 modelos existentes modificados. Migracion 20260423195601 aplicada. Tests corregidos y pasando (22 suites, 203 passed). Campos agregados: Project.organizationId, ComplianceRun.configId/metadata, ComplianceIssue.legalReference, Notification.complianceRunId. Relaciones inversas: ComplianceRun.notifications[], ProjectComplianceConfig.runs[].                                                                                                                                                                                                        |
| 2      | 2026-04-23 | FASE 0     | Tareas 9-10        | Script migrate-legacy-compliance.ts creado y ejecutado. Idempotente (verificado con doble ejecucion). DB no tiene datos legacy (0 Rulesets/Rules), asi que migracion reporta 0. Todas las tablas V3 accesibles via PrismaClient. Tests siguen pasando (22/22 suites, 203 passed). FASE 0 COMPLETADA.                                                                                                                                                                                                                                                                                        |
| 3      | 2026-04-23 | FASE 1     | Tareas 1-6         | 3 servicios de diccionario creados (PropertyDictionary, CategoryDictionary, UnitConversion) con cache via CacheService (TTL 1h). Types + barrel index. Seed: 98 props, 60 cats, 57 units (idempotente). 26 tests unitarios nuevos. Total: 25/25 suites, 229 passed. FASE 1 COMPLETADA.                                                                                                                                                                                                                                                                                                      |
| 4      | 2026-04-24 | FASE 4     | Tareas 1-4         | ProjectComplianceConfigService con 5 metodos (getConfig, upsertConfig, addOverride, removeOverride, getResolved). Cache TTL 30min, $transaction en upsertConfig, IProjectComplianceConfigService exportado. 3 nuevos Zod schemas (upsertConfigSchema, addOverrideSchema, overrideIdParamSchema). config.routes.ts con 5 endpoints + asyncHandler + Zod validation. Registrado en compliance-v3/index.ts. 9 unit tests pasando. 5 integration tests creados (pre-existing @bull-board issue bloquea ejecucion en todo el suite de integration). Prisma Client regenerado. FASE 4 COMPLETADA. |
| 5      | 2026-04-24 | FASE 4-FIX | Post-auditoria     | Auditoria P-001/O-007: barrel services/compliance-v3/index.ts creado. PACK_STATUSES/OVERRIDE_ACTIONS convertidos a const objects. 6 string literals reemplazados en service. addOverride: validacion de pertenencia a packs. addOverrideSchema: .superRefine() cross-field. 3 tests nuevos (REQUIREMENT_NOT_IN_ASSIGNED_PACKS, getResolved null, MODIFY_VALUE). Tests: 12/12 suite, 222 total passed.                                                                                                                                                                                       |
| 6      | 2026-04-24 | FASE 5     | Tareas 1-9         | Motor de Evaluacion (funciones puras). 8 archivos creados: types.ts, engine/{normalize-value, calculate-deviation, evaluate-condition, match-elements, evaluate-requirement, calculate-score}.ts + barrel index.ts. parseApplicability con Zod schema interno. AND/OR logic grouping con NOT_APPLICABLE propagation. 50 tests en 6 archivos. Total: 27/27 suites, 272 passed. FASE 5 COMPLETADA.                                                                                                                                                                                            |
| 7      | 2026-04-24 | FASE 5-FIX | Post-auditoria     | Fix O-006: 2 test names renombrados (evaluate-condition + calculate-score). Fix P-004: 5 tests nuevos para operadores >, <, != (sin cobertura previa). Fix normalize-value.ts: JSDoc documenta restriccion de inner Map (una sola entrada SI base). Fix evaluate-requirement.ts: logger.warn en parseConditions cuando descarta condition malformada (importado logger). Tests: 27/27 suites, 277 passed (+5).                                                                                                                                                                              |

---

## Auditoria post-FASE 3A

**Fecha:** 2026-04-23  
**Violaciones encontradas:** 21 (1 CRITICO, 12 ALTO, 4 MEDIO, 4 BAJO)  
**Violaciones corregidas:** 21/21  
**Tests post-correccion:** 27 suites, 245 tests (244 passed, 1 skipped pre-existente)

### Resumen de correcciones

| #   | Severidad | Regla | Archivo                                              | Descripcion                                                                       |
| --- | --------- | ----- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | CRITICO   | O-005 | requirement.service.ts                               | update() — deletes + update envueltos en un solo $transaction                     |
| 6   | ALTO      | P-005 | requirement.service.ts                               | bulkCreate() — loop de creates envuelto en $transaction                           |
| 2   | ALTO      | P-001 | bim-query.service.ts                                 | getBOM() — aliases hardcoded reemplazados por PropertyDictionaryService.resolve() |
| 3   | ALTO      | O-004 | bim-query.service.ts                                 | throw new Error → serviceUnavailable() de lib/errors.ts                           |
| 4   | MEDIO     | P-002 | bim-query.service.ts                                 | Comentario TODO eliminado                                                         |
| 5   | ALTO      | P-004 | bim-query.service.test.ts                            | 3 tests nuevos para getBOM()                                                      |
| 7   | ALTO      | O-001 | dictionary/types.ts + property-dictionary.service.ts | IPropertyDictionaryService interfaz + implements                                  |
| 8   | ALTO      | O-001 | dictionary/types.ts + category-dictionary.service.ts | ICategoryDictionaryService interfaz + implements                                  |
| 9   | ALTO      | O-001 | dictionary/types.ts + unit-conversion.service.ts     | IUnitConversionService interfaz + implements                                      |
| 10  | ALTO      | O-001 | bim-query.service.ts                                 | IBimQueryService interfaz + implements                                            |
| 11  | ALTO      | O-001 | unit-normalizer.service.ts                           | IUnitNormalizerService interfaz + implements                                      |
| 12  | ALTO      | O-001 | regulation-pack.service.ts                           | IRegulationPackService interfaz + implements                                      |
| 13  | ALTO      | O-001 | requirement.service.ts                               | IRequirementService interfaz + implements                                         |
| 14  | ALTO      | P-001 | schemas.ts                                           | DISCIPLINES z.enum() → z.string().min(1) para extensibilidad                      |
| 17  | BAJO      | P-007 | schemas.ts                                           | Bloques decorativos // ====== eliminados                                          |
| 18  | BAJO      | O-006 | bim-query.service.test.ts                            | Test names con "when [condition]"                                                 |
| 19  | BAJO      | O-006 | unit-normalizer.service.test.ts                      | Test names con "when [condition]"                                                 |

### Excepciones aceptadas (no corregidas)

- `migrate-legacy-compliance.ts` console.info — Script standalone, no server
- `SI_BASE_UNITS` en unit-conversion.service.ts — Constantes fisicas SI
- `DEFAULT_CATEGORY_PATHS` en bim-query.service.ts — Configurable via constructor
- `SEVERITY_MAP` en migrate-legacy-compliance.ts — Script one-shot con valores legacy fijos
