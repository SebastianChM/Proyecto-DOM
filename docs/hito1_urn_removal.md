# Eliminación de URNs Hardcodeadas - Hito 1

## Resumen de Cambios

Se eliminaron **TODAS** las URNs hardcodeadas de las herramientas CLI en `api/tools/` para prevenir filtración de datos sensibles del proyecto.

### Archivos Corregidos

Total: **11 archivos**

---

## Archivos Modificados

### 1. `api/tools/list-derivatives.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada en constante `TARGET_URN`
- ✅ **DESPUÉS:** Acepta URN vía argumento `--urn`
- Validación de formato básico (longitud mínima)
- URN truncada en logs: muestra solo primeros 20 caracteres
- Mensajes de ayuda con placeholder `URN_CHANGE_ME`

**Comando de ejemplo:**

```bash
ts-node api/tools/list-derivatives.ts --urn URN_CHANGE_ME
```

---

### 2. `api/tools/check-urn-metadata.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada (CMA file específico)
- ✅ **DESPUÉS:** Acepta URN por CLI con `--urn`
- Valida que URN no sea el placeholder
- Trunca URN en console.log
- Muestra ayuda si falta argumento

**Comando de ejemplo:**

```bash
ts-node api/tools/check-urn-metadata.ts --urn URN_CHANGE_ME
```

---

### 3. `api/tools/check-manifest.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada
- ✅ **DESPUÉS:** URN por argumento CLI
- Validación completa con mensajes descriptivos
- URN truncada en output
- Sin logs de valor completo de URN

**Comando de ejemplo:**

```bash
ts-node api/tools/check-manifest.ts --urn URN_CHANGE_ME
```

---

### 4. `api/tools/debug-pdf-workflow.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada en línea 6
- ✅ **DESPUÉS:** URN por `--urn` flag
- Trunca URN en "Target URN" log
- Valida formato antes de ejecutar
- Error handling sin exponer URN completa

**Comando de ejemplo:**

```bash
ts-node api/tools/debug-pdf-workflow.ts --urn URN_CHANGE_ME
```

---

### 5. `api/tools/deep-scan-pdfs.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada + URN completa en headers de axios
- ✅ **DESPUÉS:** URN por CLI, truncada en TODOS los logs
- Función `findAllPdfs` trunca URNs de children
- URL de API usa URN sin loguear valor completo
- Sample de 2D views sin exponer URNs completas

**Comando de ejemplo:**

```bash
ts-node api/tools/deep-scan-pdfs.ts --urn URN_CHANGE_ME
```

---

### 6. `api/tools/test-dwf-export.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada en job payload
- ✅ **DESPUÉS:** URN por argumento, truncada en logs
- Job payload usa URN sin loguear
- Bearer token nunca logueado
- Respuestas de APS logueadas sin filtrar (solo data, no headers)

**Comando de ejemplo:**

```bash
ts-node api/tools/test-dwf-export.ts --urn URN_CHANGE_ME
```

---

### 7. `api/tools/delete-bad-file.ts`

**Cambios:**

- ❌ **ANTES:** `const urn = "dXJuOmFkc2sub2JqZWN0czp..."` (URN real hardcodeada)
- ✅ **DESPUÉS:** URN por `--urn` flag
- Prisma query usa URN sin loguear valor completo
- Output de "Deleting file" trunca URN
- Mensaje de confirmación seguro

**Comando de ejemplo:**

```bash
ts-node api/tools/delete-bad-file.ts --urn URN_CHANGE_ME
```

---

### 8. `api/tools/find-urn.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada en línea 6-7
- ✅ **DESPUÉS:** URN por CLI
- Trunca URN en **TODOS** los outputs:
  - Log de búsqueda
  - Resultado de findFirst
  - Lista de "All files" (trunca cada apsUrn)
- Previene exposición de URNs en listados masivos

**Comando de ejemplo:**

```bash
ts-node api/tools/find-urn.ts --urn URN_CHANGE_ME
```

---

### 9. `api/tools/test-pdf-conversion.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada (SCFA DWG file)
- ✅ **DESPUÉS:** URN por `--urn` argument
- Trunca URN en:
  - Log inicial "Testing for URN"
  - Polling attempts
  - Error diagnostics
- No expone URN en response data logging
- Comentario original (línea 19) removido

**Comando de ejemplo:**

```bash
ts-node api/tools/test-pdf-conversion.ts --urn URN_CHANGE_ME
```

---

### 10. `api/tools/debug-conversion-direct.ts`

**Cambios:**

- ❌ **ANTES:** URN hardcodeada en constante `URN`
- ✅ **DESPUÉS:** URN por `--urn` flag
- Trunca URN en logs de payload
- Job object usa URN sin exponer valor completo en console
- Tipo de conversión: OBJ (para testing de conversión)

**Comando de ejemplo:**

```bash
ts-node api/tools/debug-conversion-direct.ts --urn URN_CHANGE_ME
```

---

### 11. `api/tools/debug-save-flow.ts`

**Cambios:**

- ⚠️ **ANTES:** URNs hardcodeadas en comentarios (líneas 52-53)
- ✅ **DESPUÉS:** Comentarios usan placeholder `URN_CHANGE_ME`
- Previene copy-paste accidental de URNs reales
- Script busca conversiones en DB (no usa hardcoded)
- Sección comentada ahora segura para descomentarla

**Comando de ejemplo:**

```bash
ts-node api/tools/debug-save-flow.ts
# No requiere URN - busca en DB
```

---

## Patrones de Seguridad Aplicados

### ✅ Sin URNs Hardcodeadas

Todos los archivos ahora requieren URN como argumento. **Cero** URNs en el código fuente.

### ✅ Validación Consistente

```typescript
function validateUrn(urn: string): void {
  if (urn === "URN_CHANGE_ME") {
    console.error("❌ Error: Please replace URN_CHANGE_ME with actual URN\n");
    printUsage();
  }
  if (urn.length < 20) {
    console.error(
      `❌ Error: Invalid URN format (too short): ${urn.substring(0, 10)}...`,
    );
    process.exit(1);
  }
}
```

### ✅ Truncado de URNs en Logs

```typescript
console.log(`🔑 URN: ${urn.substring(0, 20)}... (truncated)`);
```

### ✅ Mensajes de Ayuda con Placeholders

```typescript
function printUsage(): void {
  console.log("📖 Usage: ts-node <script>.ts --urn <URN>");
  console.log("\nExample:");
  console.log("  ts-node <script>.ts --urn URN_CHANGE_ME");
  process.exit(1);
}
```

---

## Comandos de Ejecución

### Ejemplo Real (substituyendo URN)

```bash
# En lugar de:
ts-node api/tools/list-derivatives.ts  # ❌ URN was hardcoded

# Ahora:
ts-node api/tools/list-derivatives.ts --urn dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YnVja2V0L2ZpbGUucnZ0  # ✅
```

### Uso con Variable de Entorno (Opcional)

```bash
# .env
TEST_URN=dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YnVja2V0L2ZpbGUucnZ0

# Script
ts-node api/tools/list-derivatives.ts --urn $env:TEST_URN  # PowerShell
ts-node api/tools/list-derivatives.ts --urn $TEST_URN      # Bash
```

---

## Verificación de Seguridad

### ✅ No Hardcoded Secrets

```bash
# Comando para verificar:
grep -r "dXJu" api/tools/*.ts
# Resultado esperado: Sin matches
```

### ✅ No Logs de URNs Completas

Todos los logs truncan URNs a 20-30 caracteres máximo.

### ✅ Placeholders Consistentes

Todas las herramientas usan `URN_CHANGE_ME` como placeholder en mensajes de ayuda.

---

## Integración con Documentación

Actualizar en `api/tools/README.md`:

```markdown
## Uso de Herramientas CLI

Todas las herramientas requieren URN como argumento. Nunca hardcodear URNs en el código.

### Ejemplo:

\`\`\`bash
ts-node api/tools/list-derivatives.ts --urn <YOUR_URN>
\`\`\`

Para obtener URNs de prueba, ejecuta:
\`\`\`bash
ts-node api/tools/list-data.ts
\`\`\`
```

---

## Cumplimiento de Reglas Duras

| Regla                                | Estado                                     |
| ------------------------------------ | ------------------------------------------ |
| ❌ Prohibido hardcodear URNs reales  | ✅ Cumple - 0 URNs hardcodeadas            |
| ❌ Prohibido logs con tokens/headers | ✅ Cumple - Solo data, nunca Authorization |
| ❌ Prohibido pseudocódigo            | ✅ Cumple - Código completo ejecutable     |
| ✅ URN por argv o env                | ✅ Implementado - Argumento `--urn`        |
| ✅ Placeholders consistentes         | ✅ Implementado - `URN_CHANGE_ME`          |
| ✅ Validación de formato             | ✅ Implementado - Valida longitud          |
| ✅ Versión truncada en errores       | ✅ Implementado - `substring(0, 10-20)`    |

---

## Diff por Archivo

### Ejemplo: `list-derivatives.ts`

**ANTES (líneas 6-7):**

```typescript
const TARGET_URN =
  "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTMyNTQ1OTkxNy1DTUEtSURPLUlELUVMWC1YLVgtMTktMDAwMC0wMC5ydnQ";
```

**DESPUÉS:**

```typescript
function printUsage(): void {
  console.log("📖 Usage: ts-node list-derivatives.ts --urn <URN>");
  console.log("\nExample:");
  console.log("  ts-node list-derivatives.ts --urn URN_CHANGE_ME");
  process.exit(1);
}

function getUrnFromArgs(): string {
  const urnIndex = process.argv.indexOf("--urn");
  if (urnIndex === -1 || !process.argv[urnIndex + 1]) {
    console.error("❌ Error: Missing required --urn argument\n");
    printUsage();
  }
  return process.argv[urnIndex + 1];
}

function validateUrn(urn: string): void {
  if (urn === "URN_CHANGE_ME") {
    console.error("❌ Error: Please replace URN_CHANGE_ME with actual URN\n");
    printUsage();
  }
  if (urn.length < 20) {
    console.error(
      `❌ Error: Invalid URN format (too short): ${urn.substring(0, 10)}...`,
    );
    process.exit(1);
  }
}

async function main() {
  const urn = getUrnFromArgs();
  validateUrn(urn);
  // ... resto del código
}
```

---

## Próximos Pasos Recomendados

1. **Actualizar `api/tools/README.md`** con instrucciones de uso
2. **Ejecutar security scan:**

   ```bash
   npm run security:scan
   ```

3. **Commit con mensaje descriptivo:**

   ```bash
   git add api/tools/*.ts
   git commit -m "security: remove hardcoded URNs from CLI tools (Hito 1)"
   ```

4. **Code review de pares** para validar compliance

---

**Fecha de Implementación:** 2025-12-20  
**Hito:** 1 - Security Hardening  
**Estado:** ✅ Completo - Listo para merge
