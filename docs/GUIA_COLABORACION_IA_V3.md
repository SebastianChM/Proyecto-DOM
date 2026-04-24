# Guia de Colaboracion Humano-IA para Compliance Engine V3

## El Problema del Contexto

La IA tiene una ventana de contexto limitada. En conversaciones largas, los mensajes iniciales se comprimen o desaparecen. Esto significa que despues de ~30-40 prompts, la IA puede "olvidar" reglas criticas del master plan. Esta guia resuelve eso.

---

## Arquitectura de la Colaboracion

```
┌─────────────────────────────────────────────────────────┐
│                    DOCUMENTOS ANCLA                       │
│                                                           │
│  COMPLIANCE_ENGINE_V3_MASTER_PLAN.md  ← Que hacer         │
│  COMPLIANCE_V3_PROGRESS.md            ← Donde estamos     │
│  /memories/repo/compliance-v3-context.md ← Resumen IA     │
│                                                           │
│  La IA lee estos 3 archivos al inicio de cada sesion.     │
│  Son la fuente de verdad. Nunca se ignoran.               │
└─────────────────────────────────────────────────────────┘
```

---

## Regla #1: Una Sesion = Una Fase (o sub-fase)

No intentes hacer multiples fases en una sola conversacion. Cada sesion de chat debe enfocarse en UNA fase o en un subset claro de tareas dentro de una fase.

| Fase | Sesiones estimadas | Descripcion |
|------|--------------------|-------------|
| 0 | 1-2 | Schema migration + data migration |
| 1 | 1-2 | Diccionarios + seeds + tests |
| 2 | 1 | BIM query refactor + tests |
| 3 | 2-3 | CRUD packs + requirements + routes + tests |
| 4 | 1 | Project config + tests |
| 5 | 3-4 | Motor de evaluacion (7 funciones puras + tests) |
| 6 | 1-2 | Orquestador + runs + cache + notifications |
| 7 | 1 | LLM suggestions |
| 8 | 2-3 | Frontend hooks + UI |
| 9 | 1 | Dashboard unification + export |
| 10 | 1 | Legacy cleanup |

---

## Regla #2: Prompt de Inicio de Sesion

**Cada vez que abras un chat nuevo**, empieza con este prompt:

```
Estamos implementando el Compliance Engine V3. Lee estos 3 archivos antes de hacer nada:

1. docs/COMPLIANCE_ENGINE_V3_MASTER_PLAN.md (secciones relevantes a la fase actual)
2. docs/COMPLIANCE_V3_PROGRESS.md (estado actual)
3. /memories/repo/compliance-v3-context.md (si tienes acceso a memory)

La fase actual es: FASE [X]
La tarea especifica es: [descripcion breve]

Reglas inviolables:
- Sigue EXACTAMENTE lo que dice el master plan
- Si hay ambiguedad, consulta el plan, no inventes
- Al terminar cada tarea, actualiza COMPLIANCE_V3_PROGRESS.md
```

No necesitas memorizar esto — esta aqui para copiar y pegar.

---

## Regla #3: Prompt de Fin de Sesion

**Antes de cerrar un chat**, pide:

```
Actualiza COMPLIANCE_V3_PROGRESS.md con todo lo que hicimos hoy.
Marca las tareas completadas y agrega notas relevantes al log de sesiones.
```

Esto asegura que la proxima sesion sabe exactamente donde retomar.

---

## Regla #4: Verificacion Cruzada

Si en algun momento sospechas que la IA esta "inventando" o se desvio del plan, usa este prompt de rescate:

```
PARA. Lee la seccion [X] del master plan (docs/COMPLIANCE_ENGINE_V3_MASTER_PLAN.md, lineas aprox [Y]-[Z]) y compara con lo que acabas de generar. ¿Es consistente?
```

Senales de que la IA perdio contexto:
- Crea un archivo que el plan dice que no se debe crear
- Usa `console.log` en vez del Logger existente
- Crea clases de error nuevas en vez de usar AppError
- Hardcodea valores de dominio (categorias, propiedades, unidades)
- Propone rutas con prefijo diferente a `/api/compliance-v3`
- Modifica archivos marcados como "DO NOT TOUCH"
- Crea un CacheService nuevo en vez de usar `lib/redis.ts`

---

## Regla #5: Granularidad de Prompts

**MAL** (demasiado vago):
```
Implementa la FASE 3
```

**BIEN** (especifico y acotado):
```
FASE 3, Tarea 1: Crea el RegulationPackService segun seccion 5.1 del master plan.
Debe tener: CRUD basico, version management, publish flow.
El modelo ya existe en Prisma (lo creamos en FASE 0).
```

**MEJOR** (con contexto de archivos):
```
FASE 3, Tarea 1: Crea RegulationPackService.
- Ubicacion: apps/api/src/services/compliance-v3/regulation-pack.service.ts
- Modelo: RegulationPack (ya en schema.prisma)
- Patron: seguir el estilo de los servicios existentes en services/
- Validacion: Zod (ya instalado, ^4.2.1)
- Errors: usar AppError de lib/errors.ts
- Log: usar logger de lib/logger.ts
```

---

## Regla #6: Tests Siempre al Final de Cada Tarea

Nunca dejes tests para despues. El ciclo es:

```
1. Escribir codigo del servicio
2. Escribir tests inmediatamente
3. Correr tests (npm test)
4. Fixear si fallan
5. Marcar tarea como DONE en progress tracker
6. Siguiente tarea
```

Si una sesion se alarga, es mejor terminar con tests que terminar con mas codigo sin tests.

---

## Regla #7: Refrescamiento de Contexto

Si la conversacion pasa de 20 mensajes, considera:

**Opcion A — Leer el plan otra vez:**
```
Lee la seccion 6.3 del master plan y asegurate de que tu proximo codigo sigue esas interfaces exactas.
```

**Opcion B — Nueva sesion:**
Si sientes que las respuestas pierden precision, cierra el chat y abre uno nuevo con el prompt de inicio (Regla #2). No es ineficiente — es lo correcto.

---

## Regla #8: El Plan No Se Modifica en Caliente

Si durante la implementacion descubres que algo del plan necesita cambiar:

1. **PARA** la implementacion
2. **DOCUMENTA** el problema exacto
3. **DISCUTE** la solucion
4. **ACTUALIZA** el master plan primero
5. **LUEGO** implementa

Nunca implementes algo diferente al plan sin actualizar el plan antes.

---

## Workflow Visual por Sesion

```
                    ┌────────────────────┐
                    │  ABRIR NUEVA       │
                    │  SESION DE CHAT     │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  PROMPT DE INICIO  │
                    │  (Regla #2)        │
                    │  IA lee 3 archivos │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
              ┌────▶│  TAREA ESPECIFICA  │
              │     │  (Regla #5)        │
              │     └────────┬───────────┘
              │              │
              │              ▼
              │     ┌────────────────────┐
              │     │  CODIGO + TESTS    │
              │     │  (Regla #6)        │
              │     └────────┬───────────┘
              │              │
              │              ▼
              │     ┌────────────────────┐
              │     │  ¿Tests pasan?     │───No──▶ Fix
              │     └────────┬───────────┘         │
              │              │ Si                   │
              │              ▼                      │
              │     ┌────────────────────┐          │
              │     │  MARCAR TAREA      │◀─────────┘
              │     │  COMPLETADA        │
              │     └────────┬───────────┘
              │              │
              │              ▼
              │     ┌────────────────────┐
              │     │ ¿Mas tareas en la  │
              │     │  fase?             │───Si──┐
              │     └────────┬───────────┘       │
              │              │ No                 │
              │              ▼                    │
              │     ┌────────────────────┐        │
              │     │  ¿>20 mensajes?    │───No───┘
              │     └────────┬───────────┘
              │              │ Si
              │              ▼
              │     ┌────────────────────────┐
              │     │  PROMPT DE FIN         │
              │     │  (Regla #3)            │
              │     │  Actualizar PROGRESS   │
              │     └────────┬───────────────┘
              │              │
              │              ▼
              │     ┌────────────────────┐
              └─────│  NUEVA SESION      │
                    └────────────────────┘
```

---

## Checklist Rapido (para tener a mano)

Antes de cada prompt de implementacion:
- [ ] ¿La IA leyo el plan para esta fase?
- [ ] ¿Le indique la tarea exacta y los archivos involucrados?

Despues de cada respuesta de la IA:
- [ ] ¿El codigo usa `logger` de `lib/logger.ts` y no `console.log`?
- [ ] ¿Los errores usan `AppError` de `lib/errors.ts`?
- [ ] ¿Las rutas empiezan con `/api/compliance-v3`?
- [ ] ¿No hay valores hardcodeados de dominio?
- [ ] ¿Uso CacheService de `lib/redis.ts` y no creo uno nuevo?
- [ ] ¿Los nombres de variables/funciones son en ingles?

Al cerrar sesion:
- [ ] ¿Se actualizo COMPLIANCE_V3_PROGRESS.md?
- [ ] ¿Los tests pasan?

---

## Prompt Templates Listos para Copiar

### Inicio de sesion nueva
```
Estamos implementando el Compliance Engine V3. Lee estos archivos:
1. docs/COMPLIANCE_ENGINE_V3_MASTER_PLAN.md (secciones [X] a [Y])
2. docs/COMPLIANCE_V3_PROGRESS.md

Fase actual: FASE [N]
Tarea: [descripcion]
```

### Pedir implementacion especifica
```
Implementa [nombre del servicio/archivo] segun la seccion [X.Y] del master plan.
Ubicacion: [path del archivo]
Usa: AppError (lib/errors.ts), logger (lib/logger.ts), CacheService (lib/redis.ts) segun aplique.
Incluye tests unitarios.
```

### Verificar consistencia
```
Lee las lineas [inicio]-[fin] del master plan y verifica que el codigo que generaste es 100% consistente.
```

### Fin de sesion
```
Actualiza docs/COMPLIANCE_V3_PROGRESS.md: marca completadas las tareas [lista] de FASE [N] y agrega una entrada al log de sesiones con fecha de hoy y resumen.
```

### Rescate (si la IA parece perdida)
```
STOP. Relee docs/COMPLIANCE_ENGINE_V3_MASTER_PLAN.md seccion [X]. Compara con lo que acabas de hacer. ¿Es consistente? Si no, corrige.
```
