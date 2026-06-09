# Compliance Engine V3 — Master Plan de Implementacion

**Proyecto:** Proyecto-DOM — Sistema de Compliance BIM  
**Version del plan:** 2.1 (FINAL — lista para ejecucion)  
**Fecha:** 23 de Abril 2026  
**Alcance:** Motor de compliance multi-pais, multi-disciplina, production-grade  
**Changelog v2.0:** Auditoria completa — se agregan secciones 5.3 (ciclo de vida), 5.4 (disciplinas), 6.4 (cache Redis), 6.5 (error handling APS), 6.6 (rendimiento), 6.7 (concurrencia), 7.5 (operador range), 8.X (detalles de paginacion, batch limits, migracion de datos, frontend hooks, notificaciones). Se corrigen inconsistencias de schema y se completa estrategia de migracion.
**Changelog v2.1:** Auditoria profunda contra codebase real (42 servicios, 38 rutas, 30 modelos). Se corrige: ComplianceRun.status usa RUNNING no IN_PROGRESS, ruta V3 sera `/api/compliance-v3` (no /api/v3), CacheService y Logger ya existen en lib/, se agrega seccion 4.3b disposicion completa de archivos por fase, se documentan 6 servicios faltantes (discipline-detector, supremacy-engine, mop-parser, domain layer), se ajusta Notification model.

---

## TABLA DE CONTENIDOS

1. [Vision General](#1-vision-general)
2. [Reglas de Desarrollo — Lo Prohibido](#2-reglas-de-desarrollo--lo-prohibido)
3. [Reglas de Desarrollo — Lo Obligatorio](#3-reglas-de-desarrollo--lo-obligatorio)
4. [Auditoria del Codigo Actual — Que Reciclar y Que Eliminar](#4-auditoria-del-codigo-actual)
5. [Arquitectura V3 — Modelo de Datos](#5-arquitectura-v3--modelo-de-datos)
   - 5.1 Nuevos modelos de Prisma
   - 5.2 Relaciones con modelos existentes
   - 5.3 Ciclo de vida de un Requirement (Estado)
   - 5.4 Catalogo de disciplinas
   - 5.5 Estrategia de migracion de datos legacy
6. [Arquitectura V3 — Motor de Evaluacion](#6-arquitectura-v3--motor-de-evaluacion)
   - 6.1 Pipeline de evaluacion
   - 6.2 Tipos del motor
   - 6.3 Funciones puras del motor
   - 6.4 Estrategia de cache (Redis)
   - 6.5 Error handling: fallos de APS y servicios externos
   - 6.6 Rendimiento: modelos grandes (100K+ elementos)
   - 6.7 Concurrencia: evaluaciones simultaneas
7. [Arquitectura V3 — Interfaces de Entrada](#7-arquitectura-v3--interfaces-de-entrada)
   - 7.1-7.4 Caminos A-D
   - 7.5 Especificacion completa de operadores
8. [Fases de Implementacion Detalladas](#8-fases-de-implementacion-detalladas)
9. [Estrategia de Testing](#9-estrategia-de-testing)
10. [Checklist de Calidad Pre-Merge](#10-checklist-de-calidad-pre-merge)
11. [Glosario Tecnico](#11-glosario-tecnico)
12. [Apendice: Resultados de la Auditoria v2.0](#12-apendice-resultados-de-la-auditoria)

---

## 1. VISION GENERAL

### Problema que resolvemos

Las empresas de ingenieria (dom-bim y similares) necesitan verificar que los modelos BIM 3D (Revit) cumplan con las especificaciones tecnicas de un proyecto y la normativa del pais. Hoy esto se hace manualmente revisando planos contra documentos PDF.

### Solucion

Un motor de compliance que:

- Recibe un modelo BIM (via APS/Autodesk)
- Lo evalua contra un conjunto de requisitos verificados por humanos
- Genera un reporte de cumplimiento con trazabilidad legal

### Principio fundamental

**Los requisitos son datos curados, no output de IA.** Un humano siempre verifica y aprueba cada requisito antes de que entre al sistema. El LLM es un acelerador opcional que sugiere requisitos, pero nunca el decisor.

### Alcance geografico

- Prototipo: Chile (MOP, OGUC, NCh)
- Expansion: Cualquier pais (Espana, Peru, Colombia, etc.)
- Arquitectura: Multi-tenant desde el dia uno

---

## 2. REGLAS DE DESARROLLO — LO PROHIBIDO

Cada regla tiene un codigo. Si durante el desarrollo se detecta una violacion, se rechaza el codigo.

### P-001: Prohibido Hardcoding de Valores de Dominio

**Definicion:** No se permite escribir directamente en el codigo fuente valores que pertenecen al dominio del negocio.

**Ejemplos de violacion:**

```typescript
// PROHIBIDO: Categorias de Revit en el codigo
const ELECTRICAL_CATEGORIES = ["Cable Trays", "Conduits", "Lighting Fixtures"];

// PROHIBIDO: Aliases de propiedades en el codigo
const aliases = { width: ["width", "ancho", "w"] };

// PROHIBIDO: Umbrales de severidad en el codigo
if (deviation > 0.2) severity = "CRITICAL";

// PROHIBIDO: Disciplinas en el codigo
type Discipline = "ELECTRICAL" | "STRUCTURAL" | "MEP";
```

**Como debe hacerse:**

```typescript
// CORRECTO: Los valores vienen de la base de datos
const categories = await prisma.categoryDictionary.findMany({
  where: { locale: project.locale },
});

// CORRECTO: Los aliases vienen de la base de datos
const aliases = await prisma.propertyDictionary.findMany({
  where: { canonicalName: "Width", locale: "es-CL" },
});

// CORRECTO: El umbral viene del requisito
if (deviation > requirement.criticalThreshold) severity = "CRITICAL";
```

**Excepcion unica:** Configuracion de infraestructura (puertos, timeouts de HTTP, tamanos de buffer) puede ir en variables de entorno o constantes de configuracion.

### P-002: Prohibido Pseudo-Codigo o Codigo Placeholder

**Definicion:** No se permite codigo que simule funcionalidad sin implementarla.

**Ejemplos de violacion:**

```typescript
// PROHIBIDO
async function evaluateRequirement(req: Requirement) {
  // TODO: implement this
  return { passed: true };
}

// PROHIBIDO
function generateReport() {
  return "Report placeholder";
}

// PROHIBIDO
const mockResult = { score: 85, issues: [] }; // "por ahora"
```

**Regla:** Si una funcion no esta implementada, no debe existir. Si se necesita como interfaz futura, debe lanzar un error explicito:

```typescript
function futureFeature(): never {
  throw new Error("Not implemented: futureFeature is scheduled for Phase 7");
}
```

### P-003: Prohibido Codigo Muerto

**Definicion:** No se permite codigo que no sea alcanzable ni ejecutable.

**Incluye:**

- Funciones que nadie llama
- Imports que nadie usa
- Variables asignadas pero nunca leidas
- Bloques `if (false)` o equivalentes
- Codigo comentado (mas de 3 lineas)

**Validacion:** ESLint con `no-unused-vars`, `no-unreachable`, `no-dead-code`. El CI rechaza si hay violaciones.

### P-004: Prohibido Funcionalidad Sin Tests

**Definicion:** Toda funcion publica de un servicio debe tener al menos un test unitario que verifique su comportamiento.

**Cobertura minima por servicio:**

- Servicios de logica de negocio: 80% de cobertura de lineas
- Servicios de infraestructura (DB, API externa): 60% de cobertura
- Utilidades puras: 90% de cobertura

**Cada test debe:**

- Tener un nombre descriptivo que explique QUE verifica
- Usar datos reales o realistas (no `"test"`, `"foo"`, `"bar"`)
- Verificar tanto el camino feliz como los errores esperados

### P-005: Prohibido Codigo No Optimizado con Impacto Medible

**Definicion:** No se permite codigo que haga operaciones innecesarias cuando el impacto es medible.

**Ejemplos de violacion:**

```typescript
// PROHIBIDO: N+1 queries
for (const req of requirements) {
  const conditions = await prisma.requirementCondition.findMany({
    where: { requirementId: req.id },
  });
}

// PROHIBIDO: Iterar todo cuando se puede filtrar en DB
const allElements = await getModelElements(urn);
const walls = allElements.filter((e) => e.category === "Walls");
```

**Como debe hacerse:**

```typescript
// CORRECTO: Eager loading
const requirements = await prisma.requirement.findMany({
  include: { conditions: true },
});

// CORRECTO: Filtrar en la fuente
const walls = await getModelElements(urn, { category: "Walls" });
```

### P-006: Prohibido Logica Sin Validacion de Entrada

**Definicion:** Toda funcion que reciba input externo (API request, archivo, parametro de usuario) debe validar la entrada antes de procesarla.

**Fronteras del sistema donde se valida:**

- Controllers/Routes: Validar request body con Zod schemas
- Servicios que reciben archivos: Validar tipo, tamano, formato
- Servicios que reciben IDs: Verificar existencia en DB antes de operar

**Dentro de servicios internos NO se re-valida** (el contrato entre servicios se garantiza por tipos TypeScript).

### P-007: Prohibido Emojis, Comentarios Decorativos, Formato AI-Like

**Definicion:** El codigo debe parecer escrito por un ingeniero profesional, no generado por IA.

**Prohibido en codigo fuente:**

- Emojis en cualquier parte del codigo, comentarios o logs
- Comentarios tipo "This function does X" al inicio de funciones obvias
- Bloques de comentarios decorativos con asteriscos o guiones
- Nombres de variables cutesy o excesivamente descriptivos tipo `theActualRealValueOfTheProperty`
- Docstrings automaticos en funciones privadas o internas

**Permitido:**

- Comentarios cuando la logica NO es obvia y explican el POR QUE, no el QUE
- JSDoc en funciones publicas de servicios que forman parte de la API interna
- Nombres de variables claros y concisos: `deviation`, `threshold`, `elements`

### P-008: Prohibido Dependencias Circulares

**Definicion:** Ningun modulo puede importar directa o indirectamente a si mismo.

**Estructura de dependencia permitida:**

```
Routes -> Controllers -> Services -> Repositories -> Prisma
                                  -> External APIs (APS)
                                  -> Domain Types
```

Un servicio puede depender de otro servicio, pero no puede haber ciclos (A->B->A).

### P-009: Prohibido Acoplamiento a Implementacion de LLM

**Definicion:** Ningun servicio core del motor de compliance puede depender directamente de un proveedor de LLM (OpenAI, Anthropic, etc.).

**Estructura correcta:**

```typescript
// La interfaz del servicio de sugerencias
interface RequirementSuggester {
  suggest(text: string, locale: string): Promise<SuggestedRequirement[]>;
}

// La implementacion concreta (puede cambiar)
class OpenAIRequirementSuggester implements RequirementSuggester { ... }
class AnthropicRequirementSuggester implements RequirementSuggester { ... }
class ManualOnlyRequirementSuggester implements RequirementSuggester {
  async suggest() { return []; } // No-op para entornos sin LLM
}
```

El motor de compliance NO sabe ni le importa si hay un LLM detras.

### P-010: Prohibido Mezclar Idiomas en Codigo

**Definicion:** Todo el codigo fuente (nombres de variables, funciones, clases, comentarios tecnicos) debe estar en ingles. El contenido de dominio (nombres de disciplinas, mensajes al usuario, labels) viene de la base de datos o archivos de internacionalizacion.

```typescript
// PROHIBIDO
const resistenciaMinima = 30;
const esValido = true;
function verificarCumplimiento() {}

// CORRECTO
const minimumStrength = 30;
const isValid = true;
function evaluateCompliance() {}
```

---

## 3. REGLAS DE DESARROLLO — LO OBLIGATORIO

### O-001: Todo Servicio Tiene Interfaz

Cada servicio debe definir una interfaz que describe su contrato publico. La implementacion es una clase que la satisface.

```typescript
// services/compliance-engine/types.ts
interface ComplianceEngine {
  evaluate(config: EvaluationConfig): Promise<EvaluationResult>;
}

// services/compliance-engine/compliance-engine.service.ts
class ComplianceEngineService implements ComplianceEngine {
  async evaluate(config: EvaluationConfig): Promise<EvaluationResult> {
    // implementacion
  }
}
```

### O-002: Validacion de Input en Boundaries con Zod

Toda ruta que reciba datos del exterior define un schema Zod. El schema se usa para validar Y para derivar el tipo TypeScript.

```typescript
// routes/compliance/schemas.ts
import { z } from "zod";

export const createRequirementSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().min(10).max(2000),
  discipline: z.string().min(1),
  legalReference: z.string().min(1),
  severity: z.enum(["MANDATORY", "RECOMMENDED", "INFO"]),
  conditions: z.array(conditionSchema).min(1),
  applicability: applicabilitySchema,
});

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
```

### O-003: Logging Estructurado

Todo servicio usa el logger centralizado con contexto. No se usa console.log.

**Logger existente:** `apps/api/src/lib/logger.ts` — Ya implementado con niveles (debug/info/warn/error), redaccion de datos sensibles, y hook de transporte externo.

```typescript
// CORRECTO
logger.info("Compliance evaluation started", {
  service: "ComplianceEngine",
  projectId,
  packCount: packs.length,
  requirementCount: totalRequirements,
});

// PROHIBIDO
console.log("Starting compliance check...");
console.log(`Found ${requirements.length} requirements`);
```

### O-004: Error Handling con Tipos Propios

Los errores del sistema usan clases de error tipadas. No se lanza `Error("something")` generico en servicios.

```typescript
// errors/compliance.errors.ts
export class RequirementNotFoundError extends Error {
  constructor(public requirementId: string) {
    super(`Requirement not found: ${requirementId}`);
    this.name = "RequirementNotFoundError";
  }
}

export class ModelNotReadyError extends Error {
  constructor(public modelUrn: string) {
    super(`Model not ready for evaluation: ${modelUrn}`);
    this.name = "ModelNotReadyError";
  }
}
```

### O-005: Transacciones para Operaciones Multi-Tabla

Toda operacion que escriba en mas de una tabla debe usar `prisma.$transaction()`.

### O-006: Tests Nombrados con Patron "should [behavior] when [condition]"

```typescript
describe("ComplianceEngineService", () => {
  describe("evaluate", () => {
    it("should return zero issues when all elements pass all requirements", async () => {});
    it("should create CRITICAL issue when deviation exceeds requirement threshold", async () => {});
    it("should skip requirements that do not apply to any element category", async () => {});
    it("should resolve property aliases using PropertyDictionary", async () => {});
  });
});
```

### O-007: Migraciones de Base de Datos con Nombre Descriptivo

```bash
# CORRECTO
npx prisma migrate dev --name add_regulation_pack_and_requirement_models

# PROHIBIDO
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
```

### O-008: Cada PR Tiene un Scope Definido

Un PR implementa UNA fase o UNA sub-tarea. No se mezclan cambios de schema con logica de negocio con UI.

### O-009: Seed Data Usa Datos Reales

Los seeds del sistema usan datos de normativa real chilena (MOP, OGUC), no datos inventados.

```typescript
// CORRECTO: Dato real de la OGUC
{
  code: "CL-OGUC-4.1.2-R001",
  description: "Los muros cortafuego deben tener resistencia al fuego minima F-120",
  legalReference: "OGUC Art. 4.1.2",
  discipline: "FIRE_PROTECTION",
}

// PROHIBIDO: Dato inventado
{
  code: "TEST-001",
  description: "Test requirement for testing",
  legalReference: "N/A",
}
```

### O-010: Funciones Puras Cuando Sea Posible

La logica de evaluacion, normalizacion, comparacion y mapeo debe ser funciones puras (sin side effects, sin acceso a DB). Solo los servicios orquestadores acceden a DB y APIs externas.

```typescript
// PURA: Solo recibe datos, retorna resultado
function evaluateCondition(
  condition: ResolvedCondition,
  actualValue: NormalizedValue,
): ConditionResult {
  // logica pura, sin DB, sin API
}

// ORQUESTADOR: Accede a DB, llama funciones puras
class ComplianceEngineService {
  async evaluate(config: EvaluationConfig) {
    const requirements = await this.resolveRequirements(config);
    const elements = await this.extractElements(config.modelUrn);
    // Llama funciones puras para evaluar
    return requirements.map((req) => evaluateRequirement(req, elements));
  }
}
```

---

## 4. AUDITORIA DEL CODIGO ACTUAL

### 4.1 Archivos a RECICLAR (modificar y conservar)

| Archivo                           | Lineas | Que conservar                                                         | Que cambiar                                                                                            | Fase   |
| --------------------------------- | ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
| `compliance-runner.service.ts`    | 427    | Logica de orquestacion, creacion de runs en DB                        | Extraer operadores a config, usar nueva tabla de Requirements en vez de Rules                          | FASE 5 |
| `compliance-kernel.service.ts`    | 295    | Logica de evaluacion y deduplicacion                                  | Eliminar ELECTRICAL_CATEGORIES hardcoded, eliminar PROPERTY_ALIASES hardcoded, usar PropertyDictionary | FASE 5 |
| `bim-query.service.ts`            | 358    | Logica de extraccion de propiedades de APS, 4-level fallback strategy | Eliminar 14 NAME_CATEGORY_PATTERNS hardcoded, usar CategoryDictionary                                  | FASE 2 |
| `unit-normalizer.service.ts`      | 68     | Estructura del servicio                                               | Mover unitMap a tabla UnitConversion en DB                                                             | FASE 2 |
| `data-extractor.service.ts`       | 362    | Lectura de Excel (ExcelJS)                                            | Mejorar deteccion de tablas PDF, eliminar header patterns hardcoded                                    | FASE 7 |
| `hierarchical-parser.service.ts`  | 160    | Estructura de arbol de secciones                                      | Sin cambios mayores, refinar regex                                                                     | FASE 7 |
| `spec-compiler/lexer.service.ts`  | 278    | Estructura del tokenizador                                            | El lexer se usara solo en el LLM-assisted path, no en el core engine                                   | FASE 7 |
| `spec-compiler/parser.service.ts` | 102    | Pattern matching                                                      | Igual que lexer: solo en LLM-assisted path                                                             | FASE 7 |
| `rules.routes.ts`                 | 506    | CRUD de reglas (sigue sirviendo para V2 legacy)                       | No se modifica. Las nuevas rutas V3 se crean en carpeta aparte                                         | N/A    |
| `runs.routes.ts`                  | 428    | Ejecucion de runs V2 (sigue sirviendo para legacy)                    | No se modifica. Las nuevas rutas V3 se crean en carpeta aparte                                         | N/A    |
| `export.routes.ts`                | 225    | Generacion PDF/CSV                                                    | Agregar referencia legal en exports                                                                    | FASE 9 |

### 4.2 Archivos a ELIMINAR

| Archivo                                                                       | Razon                                                                         | Cuando  |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| `routes/compliance/v1.routes.ts` (400 lineas)                                 | Endpoints legacy. Toda funcionalidad ya existe en V2 routes                   | FASE 10 |
| `services/validation/parser.service.ts` (235 lineas)                          | Duplica funcionalidad de spec-compiler. Consolidar en uno solo                | FASE 10 |
| `services/validation/validation.service.ts` - funcion `generateDemoResults()` | Genera datos demo hardcoded. Solo eliminar la funcion, no el archivo completo | FASE 10 |
| `services/hierarchical-spec-processor.ts` (215 lineas)                        | Se reemplaza por el LLM-assisted path que no necesita compilador custom       | FASE 10 |
| `services/mop-parser.service.ts`                                              | Parser hardcoded para MOP. Se reemplaza por LLM-assisted extraction           | FASE 10 |

**IMPORTANTE:** Ningun archivo se elimina hasta FASE 10. Durante las fases 0-9, los archivos legacy siguen funcionando en paralelo.

### 4.2b Archivos que NO se tocan (conservar intactos)

Estos servicios existentes NO forman parte del scope de V3 y no deben modificarse:

| Archivo                                               | Razon para conservar                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/discipline-detector.service.ts`             | Detecta disciplina de documentos. Util para futuro auto-assign de discipline al subir docs. No interfiere con V3.                                                 |
| `services/supremacy-engine.service.ts`                | Resuelve conflictos ET vs Normativa (regla: la mas estricta gana). Concepto valido, se podria integrar post-V3 como middleware entre packs.                       |
| `services/aps/*.ts` (14 archivos)                     | Servicios de APS. V3 los CONSUME pero no los modifica.                                                                                                            |
| `services/reporting/report.service.ts`                | Generacion de reportes. Se extiende en FASE 9 pero no se refactoriza.                                                                                             |
| `services/validation/notification.service.ts`         | Notificaciones de validacion. Sistema separado.                                                                                                                   |
| `services/validation/change-detection.service.ts`     | Deteccion de cambios. Sistema separado.                                                                                                                           |
| `domain/unified-validation-compliance/*` (5 archivos) | Capa de dominio que unifica Validation y Compliance para el dashboard. V3 debera agregar un adapter aqui en FASE 9 para que el dashboard muestre runs V3 tambien. |
| `services/viewer/*`                                   | Visor BIM. No se toca.                                                                                                                                            |
| `services/webhooks/*`                                 | Webhooks de APS. No se toca.                                                                                                                                      |

### 4.3 Modelos de Prisma — Que cambia

| Modelo actual     | Accion                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Ruleset`         | CONSERVAR INTACTO. NO renombrar. Las nuevas tablas RegulationPack/Requirement son modelos separados. Se migran datos via script. |
| `Rule`            | CONSERVAR INTACTO. NO renombrar. Los datos se copian a Requirement via script de migracion.                                      |
| `ComplianceRun`   | CONSERVAR sin cambios                                                                                                            |
| `ComplianceIssue` | CONSERVAR. Agregar campo `legalReference`                                                                                        |
| `DataSource`      | CONSERVAR sin cambios                                                                                                            |
| `ValidationRun`   | CONSERVAR (sistema legacy separado)                                                                                              |
| `ValidationIssue` | CONSERVAR (sistema legacy separado)                                                                                              |

**Modelos NUEVOS a crear:**

- `Organization`
- `RegulationPack` (extiende el concepto de Ruleset)
- `Requirement` (extiende el concepto de Rule)
- `RequirementCondition`
- `ApplicabilityRule`
- `PropertyDictionary`
- `CategoryDictionary`
- `UnitConversion`
- `ProjectComplianceConfig`
- `RequirementOverride`
- `PackDocument`

---

## 5. ARQUITECTURA V3 — MODELO DE DATOS

### 5.1 Nuevos modelos de Prisma (esquema exacto)

```prisma
// ============================================
// MULTI-TENANCY
// ============================================

model Organization {
  id        String   @id @default(uuid())
  name      String
  country   String   // ISO 3166-1 alpha-2: "CL", "ES", "PE"
  locale    String   @default("es-CL") // BCP 47
  settings  Json?    // Configuracion general de la org
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members  OrgMember[]
  projects Project[]  // Agregar relacion inversa
  packs    RegulationPack[]
}

model OrgMember {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  role           String       @default("MEMBER") // OWNER, ADMIN, MEMBER
  createdAt      DateTime     @default(now())

  @@unique([organizationId, userId])
}

// ============================================
// REGULATION PACKS
// ============================================

model RegulationPack {
  id             String       @id @default(uuid())
  code           String       @unique // "CL-MOP-V3", "ES-CTE-DBSI"
  name           String       // "MOP Manual de Carreteras Vol.3"
  description    String?
  country        String       // ISO 3166-1: "CL", "ES", "*" (global)
  version        String       // "2024.1"
  status         String       @default("DRAFT") // DRAFT, PUBLISHED, DEPRECATED
  scope          String[]     // ["STRUCTURAL", "ARCHITECTURAL"]

  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id])

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  publishedAt    DateTime?
  deprecatedAt   DateTime?

  requirements   Requirement[]
  documents      PackDocument[]
  projectConfigs ProjectComplianceConfig[]

  @@index([country])
  @@index([status])
}

model PackDocument {
  id       String @id @default(uuid())
  packId   String
  pack     RegulationPack @relation(fields: [packId], references: [id], onDelete: Cascade)
  name     String // "MOP Vol.3 Cap.4"
  fileId   String? // Referencia a File si se subio
  url      String? // Link externo
  docType  String  // LAW, STANDARD, GUIDELINE, SPEC

  createdAt DateTime @default(now())
}

// ============================================
// REQUIREMENTS (Reemplaza Rule a largo plazo)
// ============================================

model Requirement {
  id              String   @id @default(uuid())
  code            String   // "CL-MOP-V3-4.1.2-R001"
  packId          String
  pack            RegulationPack @relation(fields: [packId], references: [id], onDelete: Cascade)

  description     String   // "El hormigon estructural debe tener resistencia minima f'c = 30 MPa"
  legalReference  String   // "MOP Vol.3 Art.4.1.2"
  discipline      String   // "STRUCTURAL"
  severity        String   @default("MANDATORY") // MANDATORY, RECOMMENDED, INFO
  tags            String[] // ["hormigon", "resistencia", "estructura"]

  // Verificacion humana
  status          String   @default("DRAFT") // DRAFT, VERIFIED, ACTIVE, RETIRED
  verifiedBy      String?  // userId del verificador
  verifiedAt      DateTime?

  // Metadata
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  conditions      RequirementCondition[]
  applicability   ApplicabilityRule?
  overrides       RequirementOverride[]

  @@index([packId])
  @@index([discipline])
  @@index([status])
}

model RequirementCondition {
  id            String @id @default(uuid())
  requirementId String
  requirement   Requirement @relation(fields: [requirementId], references: [id], onDelete: Cascade)

  // Que propiedad evaluar
  propertyRef   String // Referencia al PropertyDictionary.canonicalName: "Width", "FireRating"

  // Como evaluar
  operator      String // ">=", "<=", "==", ">", "<", "!=", "range", "exists", "contains", "one_of"
  value         String // "30" o "F-120" o "REI30,REI60,REI90" (para one_of)
  unit          String? // "MPa", "mm", "m"
  tolerance     Float?  // 0.05 = 5%

  // Agrupacion logica
  logicGroup    String  @default("AND") // "AND", "OR"
  sortOrder     Int     @default(0)

  createdAt     DateTime @default(now())
}

model ApplicabilityRule {
  id              String @id @default(uuid())
  requirementId   String @unique
  requirement     Requirement @relation(fields: [requirementId], references: [id], onDelete: Cascade)

  // A que elementos aplica
  targetCategories  String[]   // ["Walls", "Structural Columns"]
  excludeCategories String[]   // ["Curtain Walls"]

  // Filtros adicionales sobre propiedades
  propertyFilters   Json?      // {"Level": "Basement", "Function": "Exterior"}

  scope             String     @default("FILTERED") // ALL, FILTERED
}

// ============================================
// PROPERTY & CATEGORY DICTIONARIES
// ============================================

model PropertyDictionary {
  id                String   @id @default(uuid())
  canonicalName     String   // "Width", "FireRating", "ConcreteStrength"
  locale            String   // "es-CL", "en-US", "es-ES"
  displayName       String   // "Ancho", "Width"
  aliases           String[] // ["Anchura", "W", "Ancho Total"]
  revitPropertyPath String?  // "Dimensions.Width"
  ifcPropertyPath   String?  // "Pset_WallCommon.Width"
  unit              String?  // "mm", "MPa"
  dataType          String   @default("NUMBER") // NUMBER, STRING, BOOLEAN, ENUM

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([canonicalName, locale])
  @@index([locale])
}

model CategoryDictionary {
  id                String   @id @default(uuid())
  canonicalName     String   // "Walls", "Structural Columns"
  locale            String   // "es-CL", "en-US"
  displayName       String   // "Muros", "Walls"
  aliases           String[] // ["Muro", "Tabique", "Pared"]
  revitCategory     String   // Nombre exacto en Revit API
  ifcEntity         String?  // "IfcWall", "IfcColumn"
  discipline        String?  // "STRUCTURAL", "ARCHITECTURAL"

  createdAt         DateTime @default(now())

  @@unique([canonicalName, locale])
  @@index([locale])
}

model UnitConversion {
  id         String @id @default(uuid())
  fromUnit   String // "mm"
  toUnit     String // "m"
  factor     Float  // 0.001
  category   String // "length", "pressure", "electrical", "area"

  @@unique([fromUnit, toUnit])
}

// ============================================
// PROJECT COMPLIANCE CONFIG
// ============================================

model ProjectComplianceConfig {
  id        String @id @default(uuid())
  projectId String @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  packs     RegulationPack[]
  overrides RequirementOverride[]
}

model RequirementOverride {
  id            String @id @default(uuid())
  configId      String
  config        ProjectComplianceConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
  requirementId String
  requirement   Requirement @relation(fields: [requirementId], references: [id])

  action        String // SKIP, MODIFY_VALUE, CHANGE_SEVERITY
  newValue      String?
  newSeverity   String?
  reason        String
  approvedBy    String // userId

  createdAt     DateTime @default(now())

  @@unique([configId, requirementId])
}
```

### 5.2 Relaciones con modelos existentes

Cambios en modelos existentes de Prisma:

- `Project`: Agregar campo `organizationId` (String?) con relacion a Organization
- `ComplianceIssue`: Agregar campo `legalReference` (String?)
- `ComplianceRun`: Agregar campo `configId` (String?) referenciando ProjectComplianceConfig
- `ComplianceRun`: Agregar campo `metadata` (Json?) para persistir progreso incremental de evaluacion (ver seccion 6.6, RunProgress)
- `Notification`: Agregar campo `complianceRunId` (String?) con relacion a ComplianceRun (actualmente solo tiene `validationRunId`)

**Registro de rutas en Express (apps/api/src/index.ts):**
Las nuevas rutas V3 se registran en el archivo principal `apps/api/src/index.ts` siguiendo el patron existente:

```typescript
// Agregar en apps/api/src/index.ts:
import { complianceV3Router } from "./routes/compliance-v3";
app.use("/api/compliance-v3", rateLimiter.apiLimiter(), complianceV3Router);
```

Esto sigue la convencion existente donde V1 esta en `/api/compliance` y V2 en `/api/compliance-v2`.

### 5.3 Ciclo de vida de un Requirement (Estado)

Un Requirement transiciona por estados con reglas estrictas. No se permite saltar estados.

```
DRAFT ──────────> VERIFIED ──────────> ACTIVE ──────────> RETIRED
  │                  │                    │
  │ (editable)       │ (editable con      │ (solo override
  │                  │  nuevo verify)     │  por proyecto)
  └──── DELETE ◄─────┘                    │
       (solo DRAFT)                       └── (no se borra,
                                               se retira)
```

**Reglas de transicion:**

- `DRAFT -> VERIFIED`: Requiere `verifiedBy` (userId) y `verifiedAt`. Solo un usuario diferente al creador puede verificar.
- `VERIFIED -> ACTIVE`: Requiere que el pack padre tenga status `PUBLISHED`.
- `ACTIVE -> RETIRED`: Siempre permitido. Se registra motivo en `notes`. Los issues historicos conservan la referencia.
- `DRAFT -> DELETE`: Solo requirements en DRAFT se pueden eliminar fisicamente. Los demas son soft-delete via RETIRED.
- Un Requirement VERIFIED puede volver a DRAFT si se edita (se resetea `verifiedBy`/`verifiedAt`).
- Un Requirement ACTIVE no se puede editar. Se debe crear una nueva version (clonar con nuevo code) y retirar la anterior.

### 5.4 Catalogo de disciplinas

Las disciplinas validas del sistema. Se almacenan como `String` (no enum Prisma) para permitir extension sin migracion.

| Codigo            | Nombre ES                 | Nombre EN          | Descripcion                                                  |
| ----------------- | ------------------------- | ------------------ | ------------------------------------------------------------ |
| `STRUCTURAL`      | Estructura                | Structural         | Elementos estructurales: columnas, vigas, fundaciones, losas |
| `ARCHITECTURAL`   | Arquitectura              | Architectural      | Muros, puertas, ventanas, cielos, pisos                      |
| `MEP`             | Mecanica General          | MEP General        | Categoria padre para disciplinas mecanicas                   |
| `ELECTRICAL`      | Electrico                 | Electrical         | Tableros, canalizaciones, luminarias, circuitos              |
| `PLUMBING`        | Sanitario                 | Plumbing           | Redes de agua potable, alcantarillado, artefactos            |
| `FIRE_PROTECTION` | Extincion                 | Fire Protection    | Redes de incendio, sprinklers, muros cortafuego              |
| `LOW_CURRENT`     | Corrientes Debiles (CCDD) | Low Current / Data | Redes de datos, CCTV, control de acceso, deteccion           |
| `HVAC`            | Climatizacion             | HVAC               | Aire acondicionado, ventilacion, ductos, equipos             |
| `CIVIL`           | Obras Civiles             | Civil              | Movimiento de tierras, pavimentos, urbanizacion              |
| `REAS`            | REAS                      | Building Services  | Instalaciones generales del edificio                         |

**Regla:** El campo `discipline` en `Requirement`, `RegulationPack.scope[]`, y `CategoryDictionary.discipline` usa estos codigos exactos. El seed del PropertyDictionary y CategoryDictionary debe incluir mapeos para todas las disciplinas.

### 5.5 Estrategia de migracion de datos legacy

La migracion desde el modelo actual (Ruleset/Rule) al nuevo (RegulationPack/Requirement) se ejecuta en la FASE 0 como script de datos, despues de crear las tablas nuevas.

**Mapeo de modelos:**

| Campo actual (Rule) | Campo nuevo (Requirement)              | Transformacion                                                                                                                                                |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `description`                          | Directo                                                                                                                                                       |
| `targetCategory`    | `ApplicabilityRule.targetCategories[]` | Wrappear en array                                                                                                                                             |
| `propertyName`      | `RequirementCondition.propertyRef`     | Usar valor directo (ya esta en ingles canonico: "Width", "Voltage", etc.). NO depende de PropertyDictionary — ese lookup se hace en runtime, no en migracion. |
| `operator`          | `RequirementCondition.operator`        | Directo                                                                                                                                                       |
| `expectedValue`     | `RequirementCondition.value`           | Directo                                                                                                                                                       |
| `unit`              | `RequirementCondition.unit`            | Directo                                                                                                                                                       |
| `tolerance`         | `RequirementCondition.tolerance`       | Convertir a decimal (5 -> 0.05)                                                                                                                               |
| `severity`          | `severity`                             | Mapear: CRITICAL->MANDATORY, WARNING->RECOMMENDED                                                                                                             |
| `sourceDocument`    | `legalReference`                       | Directo                                                                                                                                                       |
| `rulesetId`         | `packId`                               | Crear RegulationPack desde Ruleset                                                                                                                            |

**Mapeo de Ruleset -> RegulationPack:**

| Campo actual (Ruleset) | Campo nuevo (RegulationPack) | Transformacion                    |
| ---------------------- | ---------------------------- | --------------------------------- |
| `name`                 | `name`                       | Directo                           |
| `description`          | `description`                | Directo                           |
| `discipline`           | `scope[]`                    | Wrappear en array                 |
| N/A                    | `code`                       | Generar: "LEGACY-{discipline}-V1" |
| N/A                    | `country`                    | "CL" (default)                    |
| N/A                    | `version`                    | "1.0-legacy"                      |
| N/A                    | `status`                     | "PUBLISHED"                       |

**Script:** `packages/database/prisma/migrate-legacy-compliance.ts`

**Post-migracion:** Las rutas legacy (`/api/compliance/rulesets/*`) siguen funcionando contra los modelos originales. No se eliminan hasta FASE 10. Las nuevas rutas V3 (`/api/compliance-v3/packs/*`) operan contra los modelos nuevos.

---

## 6. ARQUITECTURA V3 — MOTOR DE EVALUACION

### 6.1 Pipeline de evaluacion

```
evaluateCompliance(projectId, modelUrn, options?)
  |
  |-- 1. resolveRequirements(projectId)
  |     |-- Obtener ProjectComplianceConfig
  |     |-- Obtener Requirements de todos los packs asignados
  |     |-- Aplicar overrides (SKIP, MODIFY_VALUE, CHANGE_SEVERITY)
  |     |-- Filtrar por discipline si options.discipline existe
  |     |-- Return: ResolvedRequirement[]
  |
  |-- 2. extractModelData(modelUrn, locale)
  |     |-- Llamar APS Model Properties API
  |     |-- Normalizar propiedades usando PropertyDictionary
  |     |-- Normalizar categorias usando CategoryDictionary
  |     |-- Cache en Redis (key: modelUrn + version)
  |     |-- Return: NormalizedElement[]
  |
  |-- 3. matchAndEvaluate(requirements, elements)
  |     |-- Para cada requirement:
  |     |     |-- Filtrar elements por ApplicabilityRule
  |     |     |-- Para cada element que aplica:
  |     |     |     |-- Resolver propiedad via PropertyDictionary
  |     |     |     |-- Normalizar unidades via UnitConversion
  |     |     |     |-- Evaluar TODAS las conditions (AND/OR)
  |     |     |     |-- Registrar PASS, FAIL, o NOT_APPLICABLE
  |     |-- Return: EvaluationResult[]
  |
  |-- 4. persistResults(projectId, modelUrn, results)
  |     |-- Crear ComplianceRun
  |     |-- Crear ComplianceIssues para cada FAIL
  |     |-- Calcular scores por disciplina y global
  |     |-- Return: ComplianceRun (con id)
```

### 6.2 Tipos del motor

```typescript
// types/compliance-engine.types.ts

interface EvaluationConfig {
  projectId: string;
  modelUrn: string;
  discipline?: string; // Filtro opcional
  dryRun?: boolean; // Si true, no persiste en DB
}

interface ResolvedRequirement {
  id: string;
  code: string;
  description: string;
  legalReference: string;
  discipline: string;
  severity: "MANDATORY" | "RECOMMENDED" | "INFO";
  conditions: ResolvedCondition[];
  applicability: {
    targetCategories: string[];
    excludeCategories: string[];
    propertyFilters: Record<string, string>;
    scope: "ALL" | "FILTERED";
  };
  // Si fue overridden
  overridden: boolean;
  overrideReason?: string;
}

interface ResolvedCondition {
  propertyCanonicalName: string;
  propertyAliases: string[]; // De PropertyDictionary
  operator: string;
  value: string;
  unit: string | null;
  tolerance: number | null;
  logicGroup: "AND" | "OR";
}

interface NormalizedElement {
  elementId: string; // Revit DBID
  name: string;
  category: string; // Canonico del CategoryDictionary
  properties: Map<string, NormalizedValue>;
}

interface NormalizedValue {
  raw: string; // Valor original del modelo
  numeric: number | null;
  unit: string | null;
  text: string; // Valor como texto limpio
}

interface ElementEvaluation {
  elementId: string;
  elementName: string;
  elementCategory: string;
  requirementId: string;
  requirementCode: string;
  status: "PASS" | "FAIL" | "NOT_APPLICABLE" | "ERROR";
  conditions: ConditionResult[];
  legalReference: string;
  severity: string;
}

interface ConditionResult {
  propertyName: string;
  operator: string;
  expectedValue: string;
  actualValue: string | null;
  passed: boolean;
  deviation: number | null; // Porcentaje de desviacion para numericos
  message: string;
}

interface EvaluationResult {
  totalRequirements: number;
  totalElements: number;
  evaluations: ElementEvaluation[];
  summary: {
    passed: number;
    failed: number;
    notApplicable: number;
    errors: number;
    byDiscipline: Record<string, { passed: number; failed: number }>;
    complianceScore: number; // 0-100
  };
}
```

### 6.3 Funciones puras del motor (sin DB, sin API)

Estas funciones son el corazon del motor y deben tener 100% test coverage:

```typescript
// engine/evaluate-condition.ts
function evaluateCondition(
  condition: ResolvedCondition,
  actualValue: NormalizedValue | null,
): ConditionResult;

// engine/evaluate-requirement.ts
function evaluateRequirement(
  requirement: ResolvedRequirement,
  element: NormalizedElement,
  propertyResolver: PropertyResolver,
): ElementEvaluation;

// engine/match-elements.ts
function matchElementsForRequirement(
  requirement: ResolvedRequirement,
  elements: NormalizedElement[],
): NormalizedElement[];

// engine/normalize-value.ts
function normalizeValue(
  raw: string,
  unit: string | null,
  conversions: UnitConversionMap,
): NormalizedValue;

// engine/calculate-deviation.ts
function calculateDeviation(expected: number, actual: number): number; // Porcentaje: 0.15 = 15% de desviacion

// engine/calculate-score.ts
function calculateComplianceScore(evaluations: ElementEvaluation[]): number; // 0-100
```

### 6.4 Estrategia de cache (Redis)

El motor usa Redis para cachear datos costosos de obtener (propiedades del modelo BIM, diccionarios).

**Caches definidos:**

| Key Pattern                    | Datos                                  | TTL   | Invalidacion                     |
| ------------------------------ | -------------------------------------- | ----- | -------------------------------- |
| `model:{modelUrn}:{versionId}` | NormalizedElement[] serializados       | 24h   | Manual al re-subir modelo        |
| `dict:property:{locale}`       | PropertyDictionary completo por locale | 1h    | Al modificar PropertyDictionary  |
| `dict:category:{locale}`       | CategoryDictionary completo por locale | 1h    | Al modificar CategoryDictionary  |
| `dict:units`                   | UnitConversion completo                | 6h    | Al modificar UnitConversion      |
| `config:{projectId}`           | ProjectComplianceConfig resuelto       | 30min | Al modificar config del proyecto |

**Reglas de cache:**

1. Los diccionarios se cargan completos en cache (son tablas pequenas, < 500 rows).
2. Los datos del modelo BIM se cachean por `modelUrn + versionId`. Si cambia la version, se invalida.
3. El cache de config se invalida al agregar/remover packs o overrides.
4. Todos los servicios de diccionario tienen un metodo `invalidateCache()` que se llama desde los endpoints de escritura.
5. Si Redis no esta disponible, los servicios funcionan sin cache (consultan DB directamente). No se lanza error.

**Implementacion:**

```typescript
// REUTILIZAR el CacheService existente en apps/api/src/lib/redis.ts
// Ya tiene: get, set, del, invalidatePattern, getOrSet, exists, increment
// Solo agregar las keys nuevas al helper RedisKeys existente:

// En apps/api/src/lib/redis.ts, agregar al objeto RedisKeys:
const ComplianceKeys = {
  model: (urn: string, version: string) => `compliance:model:${urn}:${version}`,
  propertyDict: (locale: string) => `compliance:dict:property:${locale}`,
  categoryDict: (locale: string) => `compliance:dict:category:${locale}`,
  units: () => `compliance:dict:units`,
  projectConfig: (projectId: string) => `compliance:config:${projectId}`,
};
```

**NO crear un CacheService nuevo.** El que existe en `lib/redis.ts` es production-ready con reconnect, pattern invalidation, y getOrSet.

### 6.5 Error handling: fallos de APS y servicios externos

**APS Model Properties API:**

| Escenario                                 | Accion                                                    | Resultado para el usuario                                       |
| ----------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| APS timeout (> 30s)                       | Reintentar 1 vez. Si falla, abortar run.                  | ComplianceRun con status `ERROR`, mensaje descriptivo           |
| APS 401 (token expirado)                  | Refrescar token automaticamente, reintentar               | Transparente                                                    |
| APS 404 (modelo no existe)                | Abortar inmediatamente                                    | ComplianceRun con status `ERROR`: "Modelo no encontrado en APS" |
| APS 429 (rate limit)                      | Esperar el `Retry-After` header, reintentar (max 2 veces) | Transparente si se recupera; ERROR si no                        |
| Modelo no traducido (translation pending) | Abortar con mensaje claro                                 | ComplianceRun con status `ERROR`: "Modelo aun en procesamiento" |

**OpenAI API (para LLM-Assisted path):**

| Escenario              | Accion                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Timeout / Error de red | Retornar `{ suggestions: [], error: "LLM service unavailable" }`                   |
| JSON invalido del LLM  | Reintentar 1 vez con prompt corregido. Si falla, retornar array vacio con warning. |
| Rate limit             | Retornar error descriptivo al usuario, no bloquear el core engine                  |

**Regla critica:** Ningun fallo del LLM o de servicios externos debe impedir el funcionamiento del core engine de evaluacion. La evaluacion contra requirements ya cargados en DB funciona offline.

### 6.6 Rendimiento: modelos grandes (100K+ elementos)

**Problema:** Un modelo BIM de hospital o industrial puede tener 50K-200K elementos. Evaluar cada elemento contra cada requirement puede ser O(N\*M) costoso.

**Estrategias:**

1. **Pre-filtrado por categoria:** Antes de evaluar, agrupar elementos por categoria. Cada requirement solo se evalua contra elementos cuya categoria matchea `ApplicabilityRule.targetCategories`. Esto reduce drasticamente el set de evaluacion.

2. **Evaluacion en batches:** Los elementos se procesan en batches de 5000. Cada batch se evalua, los resultados parciales se acumulan, y se persiste progreso incremental en `ComplianceRun.metadata`.

3. **Streaming de propiedades APS:** Para modelos grandes, usar la API de APS con paginacion (offset/limit) en vez de cargar todo en memoria.

4. **Timeout por run:** Un ComplianceRun tiene un timeout de 5 minutos. Si se excede, el run se marca como `TIMEOUT` con los resultados parciales disponibles.

5. **Estimacion pre-evaluacion:** Antes de ejecutar, contar elementos por categoria para estimar duracion. Si el modelo tiene > 100K elementos aplicables, avisar al usuario.

```typescript
// Estructura de progreso en ComplianceRun.metadata
interface RunProgress {
  totalElements: number;
  processedElements: number;
  currentBatch: number;
  totalBatches: number;
  startedAt: string;
  estimatedCompletionAt: string | null;
}
```

### 6.7 Concurrencia: evaluaciones simultaneas

**Regla:** Solo se permite UN ComplianceRun activo por proyecto a la vez.

**Implementacion:**

1. Al iniciar un run, verificar que no exista otro run con status `RUNNING` para el mismo `projectId`.
2. Si existe, retornar `409 Conflict` con el ID del run activo.
3. El status del run transiciona: `PENDING -> RUNNING -> COMPLETED | ERROR | TIMEOUT`.
4. Se usa un lock simple via campo `status` en DB (no distributed lock, para evitar complejidad).

**ComplianceRun status extendido (valores reales actuales + nuevos):**

```
// Valores actuales en DB: "PENDING", "RUNNING", "COMPLETED", "FAILED"
// V3 agrega: "TIMEOUT" (para runs que exceden el limite de 5 minutos)
// V3 agrega: "ERROR" (para fallos de APS/servicios externos, diferente de FAILED que es logico)
// NOTA: El campo status ya existe como String. NO es enum. Solo agregar nuevos valores en codigo.
```

---

## 7. ARQUITECTURA V3 — INTERFACES DE ENTRADA

### 7.1 Camino A: Editor Manual de Requirements (UI)

**Ruta:** `POST /api/compliance-v3/packs/:packId/requirements`

**Flujo:**

1. Usuario abre el editor de requisitos en la UI
2. Selecciona la disciplina (dropdown, valores de CategoryDictionary)
3. Escribe descripcion y referencia legal
4. Usa el builder visual de condiciones:
   - Selecciona propiedad (dropdown del PropertyDictionary)
   - Selecciona operador
   - Ingresa valor y unidad
   - Puede agregar multiples condiciones (AND/OR)
5. Define applicability: a que categorias aplica
6. Guarda como DRAFT
7. Otro usuario (o el mismo) lo marca como VERIFIED

### 7.2 Camino B: LLM-Assisted (Acelerador)

**Ruta:** `POST /api/compliance-v3/suggestions/analyze`

**Flujo:**

1. Usuario sube texto (pega texto o sube PDF)
2. Backend envia texto al LLM con prompt estructurado
3. LLM retorna array de SuggestedRequirement en formato JSON
4. Backend retorna las sugerencias al frontend
5. Frontend muestra cada sugerencia con botones: Approve / Edit / Reject
6. Las aprobadas se crean como Requirements con status DRAFT
7. Un humano las revisa y marca VERIFIED

**Contrato del LLM (prompt output schema):**

```typescript
interface SuggestedRequirement {
  description: string;
  legalReference: string;
  discipline: string;
  severity: "MANDATORY" | "RECOMMENDED" | "INFO";
  conditions: {
    property: string; // Debe matchear PropertyDictionary.canonicalName
    operator: string;
    value: string;
    unit: string | null;
  }[];
  applicability: {
    categories: string[]; // Debe matchear CategoryDictionary.canonicalName
  };
  confidence: number; // 0-1, auto-reportada por el LLM
}
```

**El servicio de sugerencias NO es parte del core engine.** Es un modulo aparte que solo genera datos que el humano revisa.

### 7.3 Camino C: Import IDS

**Ruta:** `POST /api/compliance-v3/packs/:packId/import/ids`

**Flujo:**

1. Usuario sube archivo .ids (XML)
2. Parser XML convierte specifications a Requirements
3. Se crean como DRAFT (necesitan verificacion humana)

### 7.4 Camino D: API Bulk

**Ruta:** `POST /api/compliance-v3/packs/:packId/requirements/bulk`

**Flujo:**

1. Sistema externo envia array de Requirements en JSON
2. Se validan contra schema Zod
3. Se crean como DRAFT
4. **Limite de batch:** Maximo 100 requirements por request. Si se envian mas, retornar `400 Bad Request`.

### 7.5 Especificacion completa de operadores

Cada operador de `RequirementCondition` tiene semantica precisa:

| Operador   | Tipo valor        | Descripcion                                                                       | Ejemplo                          |
| ---------- | ----------------- | --------------------------------------------------------------------------------- | -------------------------------- |
| `>=`       | Numerico          | Mayor o igual que. Aplica tolerancia si existe.                                   | `Width >= 200 mm`                |
| `<=`       | Numerico          | Menor o igual que. Aplica tolerancia si existe.                                   | `Height <= 3600 mm`              |
| `>`        | Numerico          | Estrictamente mayor                                                               | `Voltage > 0 V`                  |
| `<`        | Numerico          | Estrictamente menor                                                               | `Load < 5000 kg`                 |
| `==`       | Numerico o String | Igualdad exacta. Para numeros, aplica tolerancia. Para strings, case-insensitive. | `Phase == "A"`                   |
| `!=`       | Numerico o String | Diferencia.                                                                       | `Material != "Madera"`           |
| `range`    | Numerico          | Valor entre min y max inclusive. El campo `value` usa formato `"min,max"`.        | `value: "18,25"` = entre 18 y 25 |
| `exists`   | N/A               | La propiedad existe y no es null/vacia. `value` se ignora.                        | `FireRating exists`              |
| `contains` | String            | El valor de la propiedad contiene el substring (case-insensitive).                | `Material contains "hormigon"`   |
| `one_of`   | String            | El valor esta en una lista. `value` usa formato `"opcion1,opcion2,opcion3"`.      | `value: "F-60,F-90,F-120"`       |

**Tolerancia:**

- Solo aplica a operadores numericos (`>=`, `<=`, `>`, `<`, `==`, `range`).
- Se expresa como fraccion decimal: `0.05` = 5%.
- Ejemplo: `Width >= 200mm` con tolerance `0.05` pasa si Width >= 190mm (200 - 5%).
- Para `range`: tolerance se aplica al limite inferior (resta) y al superior (suma).

**Parsing del operador `range`:**

```typescript
// Ejemplo de evaluacion de range
function evaluateRange(
  value: number,
  rangeStr: string,
  tolerance: number | null,
): boolean {
  const [min, max] = rangeStr.split(",").map(Number);
  const tol = tolerance ?? 0;
  return value >= min * (1 - tol) && value <= max * (1 + tol);
}
```

**PropertyDictionary fallback chain:**
Cuando el motor busca una propiedad en un elemento BIM, sigue esta cadena:

1. Buscar por `canonicalName` exacto en las propiedades del elemento
2. Buscar por cada `alias` del PropertyDictionary (case-insensitive)
3. Buscar por `revitPropertyPath` (e.g., `"Dimensions.Width"`)
4. Si ninguno matchea, la propiedad se considera `null` -> condicion `NOT_APPLICABLE` (excepto operador `exists` que retorna `FAIL`)

---

## 8. FASES DE IMPLEMENTACION DETALLADAS

### FASE 0: Preparacion y Migracion de Schema

**Objetivo:** Crear las nuevas tablas sin romper nada existente. Migrar datos legacy.

**Archivos a crear:**

```
packages/database/prisma/migrate-legacy-compliance.ts
```

**Archivos a modificar:**

```
packages/database/prisma/schema.prisma     (agregar todos los nuevos modelos + organizationId a Project)
```

**Tareas:**

1. Agregar todos los modelos nuevos al schema de Prisma (ver seccion 5.1)
2. Agregar campo `organizationId` opcional a `Project`
3. Agregar campo `legalReference` opcional a `ComplianceIssue`
4. Agregar campo `configId` opcional a `ComplianceRun`
5. Agregar campo `complianceRunId` opcional a `Notification` (con relacion a ComplianceRun)
6. Agregar campo `metadata` (Json?) a `ComplianceRun` para persistir progreso incremental (ver seccion 6.6)
7. Extender `ComplianceRun` para aceptar nuevos valores de status: TIMEOUT, ERROR (ya tiene PENDING, RUNNING, COMPLETED, FAILED)
8. Ejecutar `prisma migrate dev --name add_compliance_v3_models`
9. Verificar que la migracion no afecta tablas existentes
10. Crear y ejecutar `migrate-legacy-compliance.ts` (ver seccion 5.5): migrar Ruleset -> RegulationPack, Rule -> Requirement
11. Verificar que los datos migrados son correctos (spot check manual)
12. NO modificar ningun servicio todavia

**Rollback:** Si la migracion de schema falla, revertir con `prisma migrate resolve --rolled-back add_compliance_v3_models`. Si la migracion de datos falla, los datos nuevos se eliminan sin afectar los originales (son tablas separadas).

**Tests:**

- Verificar que `prisma migrate deploy` funciona limpio
- Verificar que las queries existentes siguen funcionando (correr test suite completo)
- Verificar que los Rulesets/Rules originales siguen intactos

**Criterio de completitud:** Todos los tests existentes pasan. Las nuevas tablas existen. Los datos legacy estan migrados a las nuevas tablas. Las tablas originales siguen intactas.

---

### FASE 1: PropertyDictionary, CategoryDictionary, UnitConversion + Seeds

**Objetivo:** Poblar los diccionarios con datos reales y crear los servicios de consulta.

**Archivos a crear:**

```
apps/api/src/services/dictionary/property-dictionary.service.ts
apps/api/src/services/dictionary/category-dictionary.service.ts
apps/api/src/services/dictionary/unit-conversion.service.ts
apps/api/src/services/dictionary/types.ts
apps/api/src/services/dictionary/index.ts
packages/database/prisma/seed-dictionaries.ts
apps/api/tests/unit/services/dictionary/property-dictionary.service.test.ts
apps/api/tests/unit/services/dictionary/category-dictionary.service.test.ts
apps/api/tests/unit/services/dictionary/unit-conversion.service.test.ts
```

**Tareas:**

1. Crear `PropertyDictionaryService` con metodos:
   - `resolve(rawName: string, locale: string): Promise<PropertyEntry | null>` — busca por nombre exacto o alias
   - `getByCanonical(canonicalName: string, locale: string): Promise<PropertyEntry>`
   - `getAll(locale: string): Promise<PropertyEntry[]>`
2. Crear `CategoryDictionaryService` con metodos:
   - `resolve(rawCategory: string, locale: string): Promise<CategoryEntry | null>`
   - `getAll(locale: string): Promise<CategoryEntry[]>`
3. Crear `UnitConversionService` con metodos:
   - `convert(value: number, fromUnit: string, toUnit: string): Promise<number>`
   - `normalize(value: number, unit: string): Promise<NormalizedValue>` — convierte a unidad base SI
4. Crear seed script con datos reales:
   - 60+ propiedades comunes (Width, Height, FireRating, Voltage, etc.) en es-CL y en-US
   - 40+ categorias de Revit en es-CL y en-US
   - 50+ conversiones de unidades (length, pressure, electrical, area, volume)

**Tests por servicio:**

- `PropertyDictionaryService`:
  - should resolve exact canonical name match
  - should resolve alias match (case-insensitive)
  - should return null when no match found
  - should filter by locale
- `CategoryDictionaryService`:
  - should resolve exact category name
  - should resolve Spanish alias to canonical English name
  - should return null for unknown category
- `UnitConversionService`:
  - should convert mm to m
  - should convert MPa to Pa
  - should convert psi to Pa
  - should throw for unknown unit pair
  - should handle identity conversion (m to m = factor 1)

**Criterio de completitud:** Los 3 servicios tienen tests pasando. El seed corre sin errores. Los diccionarios tienen datos reales.

---

### FASE 2: Refactorizar BimQueryService y UnitNormalizerService

**Objetivo:** Eliminar todo el hardcoding de los servicios existentes.

**Archivos a modificar:**

```
apps/api/src/services/bim-query.service.ts
apps/api/src/services/unit-normalizer.service.ts
```

**Archivos a crear:**

```
apps/api/tests/unit/services/bim-query.service.test.ts
apps/api/tests/unit/services/unit-normalizer.service.test.ts
```

**Tareas:**

1. `BimQueryService`: Reemplazar los 14 `NAME_CATEGORY_PATTERNS` hardcoded por consultas a `CategoryDictionaryService.resolve()`
2. `BimQueryService`: Reemplazar los 6 `CATEGORY_PATHS` hardcoded por consulta configurable
3. `UnitNormalizerService`: Reemplazar el `unitMap` hardcoded por `UnitConversionService.normalize()`
4. Asegurar retrocompatibilidad: el output de ambos servicios no cambia de estructura

**Tests:**

- `BimQueryService`:
  - should resolve category from object tree (preferred path)
  - should resolve category from property path (fallback 1)
  - should resolve category from element name using CategoryDictionary (fallback 2)
  - should assign "Uncategorized" only when all strategies fail
  - should normalize properties for each element
- `UnitNormalizerService`:
  - should normalize "100mm" to { value: 0.1, unit: "m" }
  - should normalize "30MPa" to { value: 30000000, unit: "Pa" }
  - should handle value without unit
  - should handle invalid input gracefully

**Criterio de completitud:** Zero hardcoded category patterns o unit conversions en el codigo. Todos los tests pasan.

---

### FASE 3: RegulationPack + Requirement CRUD

**Objetivo:** API completa para crear y gestionar packs y requirements.

**Archivos a crear:**

```
apps/api/src/services/regulation-pack.service.ts
apps/api/src/services/requirement.service.ts
apps/api/src/routes/compliance-v3/packs.routes.ts
apps/api/src/routes/compliance-v3/requirements.routes.ts
apps/api/src/routes/compliance-v3/schemas.ts
apps/api/src/routes/compliance-v3/index.ts
apps/api/tests/unit/services/regulation-pack.service.test.ts
apps/api/tests/unit/services/requirement.service.test.ts
apps/api/tests/integration/compliance-v3/packs.test.ts
apps/api/tests/integration/compliance-v3/requirements.test.ts
```

**Endpoints:**

**Packs:**

- `GET /api/compliance-v3/packs` — Listar packs (filtro por country, status, scope)
- `GET /api/compliance-v3/packs/:id` — Obtener pack con count de requirements
- `POST /api/compliance-v3/packs` — Crear pack
- `PATCH /api/compliance-v3/packs/:id` — Actualizar pack
- `POST /api/compliance-v3/packs/:id/publish` — Cambiar status a PUBLISHED
- `POST /api/compliance-v3/packs/:id/deprecate` — Cambiar status a DEPRECATED

**Requirements:**

- `GET /api/compliance-v3/packs/:packId/requirements` — Listar requirements del pack (filtro por discipline, status, severity)
- `GET /api/compliance-v3/requirements/:id` — Obtener requirement con conditions y applicability
- `POST /api/compliance-v3/packs/:packId/requirements` — Crear requirement
- `PATCH /api/compliance-v3/requirements/:id` — Actualizar requirement
- `POST /api/compliance-v3/requirements/:id/verify` — Marcar como VERIFIED (requiere userId)
- `DELETE /api/compliance-v3/requirements/:id` — Soft delete (status -> RETIRED)
- `POST /api/compliance-v3/packs/:packId/requirements/bulk` — Crear multiples

**Schemas Zod para cada endpoint.** Validacion estricta de:

- `code`: pattern `/^[A-Z]{2}-[A-Z0-9-]+-R\d{3}$/` o similar
- `discipline`: debe existir en el catalogo de disciplinas (seccion 5.4)
- `conditions`: al menos una condition por requirement
- `legalReference`: no vacio
- `bulk`: maximo 100 requirements por request

**Patron de paginacion para todos los endpoints GET de listado:**

```typescript
// Schema Zod reutilizable
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// Response estandar
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Reglas de estado al crear/editar:**

- `POST /requirements` crea siempre con status `DRAFT`
- `PATCH /requirements/:id` solo permitido en status `DRAFT` o `VERIFIED` (ver seccion 5.3)
- `POST /requirements/:id/verify` solo permitido en status `DRAFT`
- Al editar un requirement VERIFIED, vuelve a DRAFT automaticamente
- `DELETE` (RETIRED) solo permitido en status `ACTIVE` o `VERIFIED`

**AuditLog:** Todas las operaciones de escritura (create, update, verify, retire, publish, deprecate) se registran en `AuditLog` con el patron existente del sistema.

**Tests:**

- Unitarios: logica de servicios
- Integracion: endpoints completos con DB real (usando test DB)

**Criterio de completitud:** CRUD completo funcional. Tests de integracion pasan con datos reales.

---

### FASE 4: ProjectComplianceConfig

**Objetivo:** Permitir que un proyecto seleccione packs y configure overrides.

**Archivos a crear:**

```
apps/api/src/services/project-compliance-config.service.ts
apps/api/src/routes/compliance-v3/project-config.routes.ts
apps/api/tests/unit/services/project-compliance-config.service.test.ts
apps/api/tests/integration/compliance-v3/project-config.test.ts
```

**Endpoints:**

- `GET /api/compliance-v3/projects/:projectId/compliance-config` — Obtener config actual
- `PUT /api/compliance-v3/projects/:projectId/compliance-config` — Crear/actualizar config (seleccionar packs)
- `POST /api/compliance-v3/projects/:projectId/compliance-config/overrides` — Agregar override
- `DELETE /api/compliance-v3/projects/:projectId/compliance-config/overrides/:id` — Eliminar override
- `GET /api/compliance-v3/projects/:projectId/compliance-config/resolved` — Preview: todos los requirements resueltos con overrides aplicados

**Criterio de completitud:** Un proyecto puede seleccionar N packs. El endpoint `/resolved` muestra todos los requirements combinados correctamente.

---

### FASE 5: Compliance Engine V3 (Motor de Evaluacion)

**Objetivo:** El motor que ejecuta la evaluacion de compliance.

**Archivos a crear:**

```
apps/api/src/services/compliance-engine-v3/types.ts
apps/api/src/services/compliance-engine-v3/compliance-engine.service.ts
apps/api/src/services/compliance-engine-v3/requirement-resolver.ts
apps/api/src/services/compliance-engine-v3/element-extractor.ts
apps/api/src/services/compliance-engine-v3/engine/evaluate-condition.ts
apps/api/src/services/compliance-engine-v3/engine/evaluate-requirement.ts
apps/api/src/services/compliance-engine-v3/engine/match-elements.ts
apps/api/src/services/compliance-engine-v3/engine/normalize-value.ts
apps/api/src/services/compliance-engine-v3/engine/calculate-deviation.ts
apps/api/src/services/compliance-engine-v3/engine/calculate-score.ts
apps/api/src/services/compliance-engine-v3/index.ts
apps/api/src/routes/compliance-v3/runs.routes.ts
apps/api/tests/unit/services/compliance-engine-v3/evaluate-condition.test.ts
apps/api/tests/unit/services/compliance-engine-v3/evaluate-requirement.test.ts
apps/api/tests/unit/services/compliance-engine-v3/match-elements.test.ts
apps/api/tests/unit/services/compliance-engine-v3/normalize-value.test.ts
apps/api/tests/unit/services/compliance-engine-v3/calculate-deviation.test.ts
apps/api/tests/unit/services/compliance-engine-v3/calculate-score.test.ts
apps/api/tests/unit/services/compliance-engine-v3/requirement-resolver.test.ts
apps/api/tests/integration/compliance-v3/evaluation.test.ts
```

**Las funciones puras del directorio engine/ son la prioridad maxima de testing.**

Cada una debe tener tests exhaustivos:

`evaluateCondition`:

- should pass when numeric value meets >= threshold
- should fail when numeric value is below >= threshold
- should pass when string value matches exactly
- should pass "one_of" when value is in allowed list
- should pass "exists" when property is present
- should pass "contains" when property includes substring
- should fail "exists" when property is null
- should handle tolerance correctly (value within tolerance = pass)
- should return NOT_APPLICABLE when property not found and operator is not "exists"
- should calculate deviation percentage for numeric failures

`matchElements`:

- should return only elements matching target categories
- should exclude elements in excludeCategories
- should apply property filters correctly
- should return all elements when scope is "ALL"
- should return empty array when no elements match

`calculateScore`:

- should return 100 when all evaluations pass
- should return 0 when all evaluations fail
- should calculate weighted score correctly
- should ignore NOT_APPLICABLE in score calculation

**Endpoints:**

- `POST /api/compliance-v3/projects/:projectId/compliance/evaluate` — Ejecutar evaluacion (retorna 202 Accepted con runId)
- `GET /api/compliance-v3/compliance/runs/:runId` — Obtener resultado de un run (incluye progreso si RUNNING)
- `GET /api/compliance-v3/projects/:projectId/compliance/runs` — Listar runs de un proyecto (paginado)
- `GET /api/compliance-v3/compliance/runs/:runId/issues` — Issues de un run (paginado, filtro por discipline, severity)

**Integracion con notificaciones:**
Al completar un ComplianceRun (COMPLETED o ERROR), se crea una `Notification` para todos los miembros del proyecto con:

- Tipo: `COMPLIANCE_RUN_COMPLETED` o `COMPLIANCE_RUN_ERROR`
- Contenido: score global, cantidad de issues criticos, link al run
- Se usa el sistema de notificaciones existente (modelo `Notification`)

**Criterio de completitud:** El motor puede evaluar un modelo real contra un pack de requirements y generar un reporte correcto. Las notificaciones se envian al completar.

---

### FASE 6: Seed Pack Chile

**Objetivo:** Crear el primer pack de regulacion real para Chile.

**Archivos a crear:**

```
packages/database/prisma/seeds/cl-oguc-pack.ts
packages/database/prisma/seeds/cl-nch433-pack.ts
packages/database/prisma/seeds/cl-electrical-pack.ts
```

**Tareas:**

1. Crear pack "CL-OGUC" con 20-30 requisitos de la OGUC (Ordenanza General de Urbanismo y Construccion)
2. Crear pack "CL-NCH433" con 10-15 requisitos sismicos
3. Crear pack "CL-ELECTRICAL" con 15-20 requisitos electricos
4. Todos con referencia legal real al articulo correspondiente
5. Todos con condiciones y applicability definidas
6. Todos con status VERIFIED

**Criterio de completitud:** Los packs se cargan en la DB. Se puede ejecutar una evaluacion contra un modelo real usando estos packs.

---

### FASE 7: LLM-Assisted Requirement Extraction

**Objetivo:** Acelerador que sugiere requirements desde texto.

**Archivos a crear:**

```
apps/api/src/services/requirement-suggester/types.ts
apps/api/src/services/requirement-suggester/requirement-suggester.interface.ts
apps/api/src/services/requirement-suggester/openai-suggester.service.ts
apps/api/src/services/requirement-suggester/manual-only-suggester.service.ts
apps/api/src/services/requirement-suggester/index.ts
apps/api/src/routes/compliance-v3/suggestions.routes.ts
apps/api/tests/unit/services/requirement-suggester/openai-suggester.test.ts
apps/api/tests/integration/compliance-v3/suggestions.test.ts
```

**La interfaz del suggester:**

```typescript
interface RequirementSuggester {
  suggest(
    text: string,
    locale: string,
    discipline?: string,
  ): Promise<SuggestedRequirement[]>;
}
```

**Implementaciones:**

- `OpenAISuggester`: Usa GPT-4 con prompt estructurado
- `ManualOnlySuggester`: Retorna array vacio (para entornos sin LLM)

**El prompt al LLM incluira:**

- El schema exacto de SuggestedRequirement
- Lista de canonicalNames validos del PropertyDictionary
- Lista de categorias validas del CategoryDictionary
- Instruccion de retornar JSON valido, sin texto adicional

**Endpoints:**

- `POST /api/compliance-v3/suggestions/analyze` — Recibe texto, retorna sugerencias
- `POST /api/compliance-v3/suggestions/:suggestionId/approve` — Aprueba y crea Requirement
- `POST /api/compliance-v3/suggestions/:suggestionId/reject` — Rechaza

**Tests:**

- Mock del LLM response para tests unitarios
- Verificar que el JSON parseado matchea el schema
- Verificar que las sugerencias aprobadas crean Requirements validos

**Criterio de completitud:** Se puede pegar texto de normativa y recibir sugerencias que, al aprobarlas, se convierten en Requirements funcionales.

---

### FASE 8: Frontend — Requirement Editor + Pack Manager

**Objetivo:** UI para gestionar packs, crear requirements, configurar proyectos.

**Archivos a crear:**

```
# API hooks layer (React Query / SWR)
apps/web/hooks/use-packs.ts
apps/web/hooks/use-requirements.ts
apps/web/hooks/use-compliance-config.ts
apps/web/hooks/use-compliance-runs.ts
apps/web/hooks/use-dictionaries.ts
apps/web/hooks/use-suggestions.ts
apps/web/lib/api/compliance-v3.ts          # API client functions

# Components
apps/web/components/compliance-v3/PackBrowser.tsx
apps/web/components/compliance-v3/PackDetail.tsx
apps/web/components/compliance-v3/RequirementEditor.tsx
apps/web/components/compliance-v3/RequirementList.tsx
apps/web/components/compliance-v3/ConditionBuilder.tsx
apps/web/components/compliance-v3/ProjectConfigPanel.tsx
apps/web/components/compliance-v3/SuggestionReviewer.tsx
apps/web/components/compliance-v3/index.ts

# Pages
apps/web/app/dashboard/projects/[id]/compliance/page.tsx
apps/web/app/dashboard/packs/page.tsx
apps/web/app/dashboard/packs/[id]/page.tsx
```

**API Client layer (`lib/api/compliance-v3.ts`):**
Todas las llamadas HTTP a los endpoints V3. No se hacen `fetch` directos desde componentes.

```typescript
// Patron para cada endpoint
export async function getPacks(params: PackListParams): Promise<PaginatedResponse<Pack>> { ... }
export async function getPackById(id: string): Promise<PackDetail> { ... }
export async function createPack(data: CreatePackInput): Promise<Pack> { ... }
// ... etc para todos los endpoints de seccion 8 fases 3-5-7
```

**Hooks layer:** Cada hook wrappea el API client con React Query (o el patron de fetching que use el proyecto). Manejan loading, error, y cache del lado cliente.

**Componentes clave:**

- `ConditionBuilder`: Visual builder de condiciones con dropdowns de PropertyDictionary (se obtiene via `useDictionaries` hook)
- `RequirementEditor`: Form completo para crear/editar requirements. Usa Zod para validacion client-side (los mismos schemas que el backend si es posible, o derivados)
- `SuggestionReviewer`: Vista de sugerencias del LLM con Approve/Edit/Reject
- `ProjectConfigPanel`: Selector de packs para un proyecto con drag-and-drop para ordenar prioridad

**Criterio de completitud:** Un usuario puede navegar packs, crear requirements, configurar un proyecto, y ver resultados.

---

### FASE 9: Dashboard de Resultados V3

**Objetivo:** Visualizacion de resultados de compliance.

**Archivos a crear:**

```
apps/web/components/compliance-v3/ComplianceDashboardV3.tsx
apps/web/components/compliance-v3/DisciplineScoreCard.tsx
apps/web/components/compliance-v3/IssueDetailPanel.tsx
apps/web/components/compliance-v3/TraceabilityMatrix.tsx
apps/web/components/compliance-v3/ComplianceExport.tsx
```

**Archivos a modificar:**

```
apps/api/src/domain/unified-validation-compliance/read-adapters.ts  (agregar adapter para ComplianceRun V3)
apps/api/src/domain/unified-validation-compliance/mappers.ts        (agregar mapeo para V3 runs/issues)
apps/api/src/domain/unified-validation-compliance/contract.ts       (agregar source "COMPLIANCE_V3" si aplica)
```

**Nota importante:** El proyecto tiene una capa de dominio en `domain/unified-validation-compliance/` que unifica los datos de Validation y Compliance V2 para el dashboard general. En FASE 9 se debe agregar un adapter que mapee los ComplianceRun/ComplianceIssue de V3 al formato unificado, para que el dashboard existente muestre ambos sistemas.

**Vistas:**

- Score global y por disciplina
- Lista de issues con referencia legal
- Traceability matrix (requirement -> element -> resultado)
- Comparacion entre runs (mejora temporal)
- Export PDF/Excel con branding dom-bim

**Criterio de completitud:** Dashboard funcional con datos reales de un run de compliance.

---

### FASE 10: IDS Import/Export + Limpieza Final

**Objetivo:** Interoperabilidad con buildingSMART IDS y limpieza del codigo legacy.

**Tareas:**

1. Parser de XML IDS -> Requirements
2. Export de Requirements -> IDS XML
3. Eliminar archivos marcados para DELETE (v1.routes.ts, validation/parser.service.ts, etc.)
4. Mover archivos obsoletos a \_quarantine
5. Actualizar documentacion

**Criterio de completitud:** Se puede importar un archivo IDS y exportar requirements como IDS. El codigo legacy esta limpio.

---

## 9. ESTRATEGIA DE TESTING

### Piramide de tests

```
              /\
             /  \       E2E (3-5 tests)
            /    \      Smoke tests del flujo completo
           /------\
          /        \    Integracion (20-30 tests)
         /          \   Routes + DB + Services combinados
        /------------\
       /              \  Unitarios (80-100 tests)
      /                \ Funciones puras, servicios aislados
     /------------------\
```

### Tests unitarios obligatorios por fase

| Fase | Servicio                              | Tests minimos |
| ---- | ------------------------------------- | ------------- |
| 1    | PropertyDictionaryService             | 5             |
| 1    | CategoryDictionaryService             | 4             |
| 1    | UnitConversionService                 | 6             |
| 2    | BimQueryService (refactorizado)       | 5             |
| 2    | UnitNormalizerService (refactorizado) | 4             |
| 3    | RegulationPackService                 | 6             |
| 3    | RequirementService                    | 8             |
| 4    | ProjectComplianceConfigService        | 5             |
| 5    | evaluateCondition                     | 10            |
| 5    | evaluateRequirement                   | 8             |
| 5    | matchElements                         | 5             |
| 5    | normalizeValue                        | 6             |
| 5    | calculateDeviation                    | 4             |
| 5    | calculateScore                        | 4             |
| 5    | requirementResolver                   | 5             |
| 7    | OpenAISuggester (mocked)              | 4             |

### Tests de integracion obligatorios

| Fase | Endpoint            | Tests minimos |
| ---- | ------------------- | ------------- |
| 3    | Packs CRUD          | 6             |
| 3    | Requirements CRUD   | 8             |
| 4    | Project config      | 4             |
| 5    | Evaluation pipeline | 5             |
| 7    | Suggestions         | 3             |

### Datos de test

Los tests usan datos derivados de normativa real chilena. Se crean fixtures reutilizables:

```typescript
// tests/fixtures/compliance-v3/requirements.fixture.ts
export const FIXTURE_REQUIREMENT_FIRE_RATING = {
  code: "CL-OGUC-4.1.2-R001",
  description: "Muros cortafuego deben tener resistencia minima F-120",
  legalReference: "OGUC Art. 4.1.2",
  discipline: "FIRE_PROTECTION",
  severity: "MANDATORY",
  conditions: [
    {
      propertyRef: "FireRating",
      operator: ">=",
      value: "120",
      unit: "min",
    },
  ],
  applicability: {
    targetCategories: ["Walls"],
    excludeCategories: [],
    scope: "FILTERED",
  },
};
```

---

## 10. CHECKLIST DE CALIDAD PRE-MERGE

Antes de hacer merge de cualquier PR de compliance V3, verificar:

**Codigo:**

- [ ] Zero hardcoding de valores de dominio (P-001)
- [ ] Ningun placeholder o pseudo-codigo (P-002)
- [ ] Ningun codigo muerto o imports sin usar (P-003)
- [ ] Sin emojis, comentarios decorativos, o formato AI-like (P-007)
- [ ] Sin dependencias circulares (P-008)
- [ ] Sin acoplamiento directo a proveedor de LLM (P-009)
- [ ] Nombres de variables/funciones en ingles (P-010)
- [ ] Input validado en boundaries con Zod (O-002)
- [ ] Logging estructurado, sin console.log (O-003)
- [ ] Errores tipados, sin Error("string") generico (O-004)
- [ ] Transacciones para operaciones multi-tabla (O-005)

**Tests:**

- [ ] Todo servicio nuevo tiene tests unitarios (P-004)
- [ ] Tests nombrados con patron "should [behavior] when [condition]" (O-006)
- [ ] Datos de test realistas, no "foo"/"bar"/"test" (O-009)
- [ ] Cobertura minima cumplida (80% negocio, 60% infra, 90% utils)

**Funcionalidad:**

- [ ] La funcionalidad fue verificada con datos reales (no solo mocks)
- [ ] No hay N+1 queries ni iteraciones innecesarias (P-005)
- [ ] Los endpoints retornan respuestas consistentes con el API contract

**Arquitectura:**

- [ ] Interfaces definidas para servicios nuevos (O-001)
- [ ] Funciones puras separadas de orquestadores (O-010)
- [ ] La migracion de Prisma tiene nombre descriptivo (O-007)

---

## 11. GLOSARIO TECNICO

| Termino                     | Definicion                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| **RegulationPack**          | Coleccion versionada de requisitos de una normativa especifica de un pais                                 |
| **Requirement**             | Requisito individual verificado por un humano, con referencia legal y condiciones evaluables              |
| **RequirementCondition**    | Condicion atomica dentro de un requirement (propiedad + operador + valor)                                 |
| **ApplicabilityRule**       | Define a que elementos del modelo BIM aplica un requirement                                               |
| **PropertyDictionary**      | Tabla de mapeo entre nombres de propiedades en diferentes idiomas y sus paths en Revit/IFC                |
| **CategoryDictionary**      | Tabla de mapeo entre categorias de elementos BIM en diferentes idiomas                                    |
| **UnitConversion**          | Tabla de factores de conversion entre unidades de medida                                                  |
| **ProjectComplianceConfig** | Configuracion de un proyecto que indica que packs aplican y que overrides tiene                           |
| **RequirementOverride**     | Modificacion de un requirement para un proyecto especifico (saltar, cambiar valor, cambiar severidad)     |
| **ComplianceRun**           | Ejecucion de una evaluacion de compliance contra un modelo                                                |
| **Evaluation**              | Resultado de evaluar un requirement contra un elemento especifico                                         |
| **NormalizedElement**       | Elemento BIM con propiedades normalizadas (nombres canonicos, unidades SI)                                |
| **SuggestedRequirement**    | Requirement propuesto por el LLM que aun no ha sido verificado por un humano                              |
| **IDS**                     | Information Delivery Specification — estandar de buildingSMART para definir requisitos de informacion BIM |

---

## NOTAS PARA CONTEXTO DE IA

Este documento es la fuente de verdad para todo el desarrollo del Compliance Engine V3. Si durante la implementacion de cualquier fase hay ambiguedad, se debe consultar este documento, no inventar soluciones.

**Reglas criticas para mantener contexto:**

1. Los requisitos son DATOS EN LA BASE DE DATOS, no codigo hardcoded
2. El LLM es un ACELERADOR que sugiere, no el que decide
3. Todo valor de dominio (categorias, propiedades, unidades, disciplinas) viene de tablas de diccionario
4. Las funciones puras del motor de evaluacion (engine/) son el corazon del sistema y deben tener cobertura de tests del 100%
5. La arquitectura es multi-pais desde el dia uno: Chile es el primer pack, no el unico
6. Cada requirement tiene referencia legal obligatoria
7. Un humano siempre verifica antes de que un requirement este ACTIVE
8. Solo UN ComplianceRun activo por proyecto a la vez (seccion 6.7)
9. Todo fallo de APS o LLM se maneja gracefully — nunca bloquea el core engine (seccion 6.5)
10. Las disciplinas NO son enum de Prisma, son strings del catalogo (seccion 5.4)

---

## 12. APENDICE: RESULTADOS DE LA AUDITORIA v2.0

### Hallazgos criticos corregidos en v2.0

| #   | Hallazgo                                                                                                                     | Severidad | Seccion afectada | Correccion                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------- | ------------------------------------------------------------------- |
| A1  | No habia estrategia de migracion de datos legacy (Ruleset/Rule -> RegulationPack/Requirement)                                | CRITICO   | 5.5, FASE 0      | Agregada seccion 5.5 con mapeo campo-a-campo y script de migracion  |
| A2  | No habia catalogo completo de disciplinas. El plan mencionaba FIRE_PROTECTION pero el schema actual solo tenia 4 disciplinas | CRITICO   | 5.4              | Agregada seccion 5.4 con 10 disciplinas documentadas                |
| A3  | No habia ciclo de vida definido para Requirements — transiciones de estado ambiguas                                          | CRITICO   | 5.3              | Agregada seccion 5.3 con maquina de estados y reglas de transicion  |
| A4  | No habia estrategia de cache Redis — solo una mencion en el pipeline                                                         | ALTO      | 6.4              | Agregada seccion 6.4 con keys, TTLs, invalidacion, fallback         |
| A5  | No habia error handling para fallos de APS API durante evaluacion                                                            | ALTO      | 6.5              | Agregada seccion 6.5 con tabla de escenarios APS + OpenAI           |
| A6  | No habia consideraciones de rendimiento para modelos grandes (100K+ elementos)                                               | ALTO      | 6.6              | Agregada seccion 6.6 con batching, pre-filtrado, timeout, streaming |
| A7  | No habia manejo de concurrencia para evaluaciones simultaneas                                                                | ALTO      | 6.7              | Agregada seccion 6.7 con lock por proyecto y status extendido       |
| A8  | Operador `range` no tenia especificacion de formato                                                                          | MEDIO     | 7.5              | Agregada seccion 7.5 con tabla completa de operadores               |
| A9  | No habia PropertyDictionary fallback chain documentada                                                                       | MEDIO     | 7.5              | Agregado al final de seccion 7.5                                    |
| A10 | No habia patron de paginacion para endpoints GET                                                                             | MEDIO     | FASE 3           | Agregado PaginatedResponse schema a FASE 3                          |
| A11 | Faltaba limite de batch para import bulk                                                                                     | BAJO      | 7.4              | Agregado limite de 100 requirements por request                     |
| A12 | No habia integracion con sistema de notificaciones existente                                                                 | MEDIO     | FASE 5           | Agregada integracion con modelo Notification                        |
| A13 | Faltaba capa de API hooks para frontend                                                                                      | MEDIO     | FASE 8           | Agregados hooks y API client layer                                  |
| A14 | Faltaba `configId` en ComplianceRun                                                                                          | BAJO      | FASE 0           | Agregado a tareas de FASE 0                                         |
| A15 | No habia rollback strategy para migraciones fallidas                                                                         | MEDIO     | FASE 0           | Agregada instruccion de rollback                                    |
| A16 | Reglas de estado para CRUD de requirements no estaban claras                                                                 | MEDIO     | FASE 3           | Agregadas reglas de estado por endpoint                             |
| A17 | No se mencionaba AuditLog para operaciones de compliance                                                                     | BAJO      | FASE 3           | Agregada integracion con AuditLog existente                         |

### Elementos validados como correctos en v1.0

- Schema Prisma de seccion 5.1: modelos bien definidos, M:N implicito correcto (ambos lados tienen array)
- Pipeline de evaluacion seccion 6.1: orden de operaciones correcto
- Tipos del motor seccion 6.2: interfaces completas y consistentes
- Funciones puras seccion 6.3: correctamente separadas de orquestadores
- 4 caminos de entrada seccion 7: cubren todos los casos de uso
- Orden de fases 0-10: dependencias correctas (cada fase depende solo de las anteriores)
- Piramide de tests seccion 9: proporciones correctas
- Prohibiciones P-001 a P-010: todas relevantes y verificables
- Obligaciones O-001 a O-010: todas relevantes y verificables
- Checklist pre-merge seccion 10: completo

### Riesgos pendientes (no bloqueantes para iniciar)

| Riesgo                                                                                  | Impacto | Mitigacion                                                                                         |
| --------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| Zod v4 (workspace usa 4.2.1) puede tener breaking changes vs v3                         | Medio   | Verificar compatibilidad al implementar schemas en FASE 3                                          |
| OrgMember.userId es String suelto, no FK a User                                         | Bajo    | Agregar relacion explicita si se necesita join directo. Por ahora suficiente para queries manuales |
| Seed data de diccionarios (FASE 1) puede ser incompleta para todas las disciplinas      | Medio   | Iterar sobre seeds conforme se implementan packs reales. No bloquea el motor.                      |
| Performance del M:N implicito en Prisma para ProjectComplianceConfig <-> RegulationPack | Bajo    | Si se detecta lentitud, migrar a tabla explicita \_ProjectPacks                                    |

### Hallazgos adicionales de auditoria v2.1 (codebase real)

| #   | Hallazgo                                                                                                                                                     | Severidad | Correccion                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| B1  | ComplianceRun.status usa "RUNNING" no "IN_PROGRESS". Plan v2.0 usaba IN_PROGRESS.                                                                            | CRITICO   | Corregido en todo el documento. Nuevos status: TIMEOUT, ERROR se agregan, no se renombra nada.                                      |
| B2  | Ruta prefix del proyecto es `/api/compliance-v2` no `/api/compliance/v2`. Plan usaba `/api/v3/`.                                                             | CRITICO   | Corregido a `/api/compliance-v3` en todo el documento (26 ocurrencias).                                                             |
| B3  | CacheService profesional ya existe en `lib/redis.ts` con getOrSet, invalidatePattern, TTL. Plan proponia crear uno nuevo.                                    | ALTO      | Corregido: se reutiliza el existente. Solo se agregan keys nuevas al helper RedisKeys.                                              |
| B4  | Logger centralizado ya existe en `lib/logger.ts` con niveles, redaccion, y transport hook.                                                                   | MEDIO     | Documentado en O-003.                                                                                                               |
| B5  | 6 servicios existentes no aparecian en la auditoria: discipline-detector, supremacy-engine, mop-parser, domain layer (5 archivos), webhooks (2), viewer (1). | ALTO      | Agregados a seccion 4.2b "Archivos que NO se tocan".                                                                                |
| B6  | Plan v2.0 proponia renombrar Ruleset -> RegulationPack. Pero Ruleset tiene FK desde ComplianceRun. Renombrar romperia todo.                                  | CRITICO   | Corregido: Ruleset/Rule se CONSERVAN intactos. RegulationPack/Requirement son modelos nuevos separados. Se migran datos via script. |
| B7  | Notification model tiene `validationRunId` FK pero no `complianceRunId`. Para notificar runs V3 se necesita agregar.                                         | MEDIO     | Agregado `complianceRunId` a FASE 0 y seccion 5.2.                                                                                  |
| B8  | Plan no indicaba como registrar nuevas rutas en Express main app.                                                                                            | MEDIO     | Agregada instruccion de registro con `app.use("/api/compliance-v3", ...)` en seccion 5.2.                                           |
| B9  | Plan indicaba que `rules.routes.ts` y `runs.routes.ts` se reciclarian. Pero modificar los archivos V2 es riesgoso.                                           | ALTO      | Corregido: V2 routes se conservan intactas. V3 crea archivos nuevos en carpeta `routes/compliance-v3/`.                             |
| B10 | `unified-validation-compliance` domain layer no aparecia en el plan. Dashboard unificado necesitara adapter V3.                                              | MEDIO     | Agregado a FASE 9 como archivos a modificar.                                                                                        |
| B11 | `validation.service.ts` tiene funcion `generateDemoResults()` que genera datos hardcoded demo.                                                               | BAJO      | Agregada a lista de eliminacion en FASE 10 (solo la funcion, no el archivo).                                                        |

### Inventario final del codebase (snapshot pre-implementacion)

```
CODEBASE SUMMARY
================
Total service files:        42 (across 7 subdirectories)
Total route files:          38 (across 7 subdirectories)
Total Prisma models:        30 (0 enums, all String-based status)
Total test files:           20 TypeScript (.test.ts) + 24 scripts/docs
Existing infrastructure:    Logger, Redis, CacheService, RateLimiter, AuditLog, Notifications
Seed files:                 3 (seed-workflows.ts, seed-sample-data.ts, seed-compliance.ts)
Frontend hooks:             7 custom hooks
Frontend lib files:         12 utility files
Route prefix convention:    /api/{feature-name} or /api/{feature-name}-v{N}
```
