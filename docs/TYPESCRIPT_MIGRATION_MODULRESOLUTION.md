# Migración: TypeScript moduleResolution → node16

## Estado actual

`apps/api/tsconfig.json` usa `"moduleResolution": "node"` (alias de `node10`).  
Esto está **deprecado desde TypeScript 5.0** y **dejará de funcionar en TypeScript 7.0**.

Como parche temporal se agregó `"ignoreDeprecations": "6.0"` para silenciar el warning sin cambiar el comportamiento.

## Por qué no se migró todavía

La migración correcta requiere cambiar a:

```jsonc
"module": "node16",
"moduleResolution": "node16"
```

Esto obliga a TypeScript a aplicar reglas ESM estrictas:

- Todos los imports relativos deben incluir extensión explícita (`.js`)
- Los `package.json` de cada paquete deben declarar `"type"` correctamente
- Algunos imports de terceros pueden romperse si sus tipos no están actualizados

El API tiene ~120+ archivos con imports relativos sin extensión. La refactorización es posible pero lleva tiempo y testing.

## Pasos para migrar cuando sea el momento

1. **Actualizar `tsconfig.json`:**

   ```jsonc
   {
     "compilerOptions": {
       "module": "node16",
       "moduleResolution": "node16",
     },
   }
   ```

   Eliminar `"ignoreDeprecations"`.

2. **Correr typecheck** y recopilar todos los errores:

   ```bash
   npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | grep "error TS"
   ```

3. **Agregar extensiones `.js`** a todos los imports relativos rotos.  
   Herramienta útil: [`fix-esm-imports`](https://github.com/nicolo-ribaudo/fix-esm-imports) o un script de sed/regex.

4. **Verificar `packages/database`** — Prisma Client genera CJS, revisar que los imports no rompan.

5. **Correr tests de integración** completos antes de mergear.

## Prioridad

Baja — no hay urgencia hasta que TypeScript 7.0 sea lanzado (sin fecha confirmada a abril 2026).  
Revisar cuando se actualice TypeScript a `>=7.0` o cuando el `ignoreDeprecations` deje de ser aceptado.
