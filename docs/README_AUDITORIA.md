# 📋 Sistema de Auditoría y Testing - DOM BIM Platform

Este sistema te ayuda a **monitorear, testear, documentar y trackear** todas las funcionalidades del proyecto de manera organizada.

---

## 📚 Documentos Principales

### 1. [AUDITORIA_FUNCIONALIDADES.md](./AUDITORIA_FUNCIONALIDADES.md)

**Tu fuente única de verdad** - Documento maestro exhaustivo

**Contiene:**

- ✅ Inventario completo de 96 funcionalidades del sistema
- 📊 Estado actual de cada funcionalidad (✅/⚠️/❌/🔍)
- 📝 Descripción detallada de cada feature
- 🧪 Casos de prueba específicos
- 🎯 Prioridades de testing (Crítico/Alto/Medio/Bajo)
- 📖 Plantillas para documentar resultados

**Cuándo usar:**

- Para entender qué debe hacer cada funcionalidad
- Para planificar sesiones de testing
- Para documentar resultados de pruebas
- Como referencia técnica del sistema

---

### 2. [CHECKLIST_TESTING.md](./CHECKLIST_TESTING.md)

**Tu tracking diario** - Checklist compacto

**Contiene:**

- ✅ Lista rápida de funcionalidades a testear
- 📊 Progreso visual por módulo
- 🐛 Lista de issues encontrados
- 📅 Planning de próxima sesión de testing

**Cuándo usar:**

- Al inicio de cada día de testing
- Para actualizar progreso rápidamente
- Para reportar status a stakeholders

**Cómo actualizar:**

```markdown
# Marcar como completado

- [x] **Subir archivos** - ✅ COMPLETADO (2026-04-14)

# Agregar issue encontrado

### Críticos ❌

- **Upload files > 100MB falla** (2026-04-14)
```

---

### 3. [REGISTRO_FIXES.md](./REGISTRO_FIXES.md)

**Knowledge base de soluciones** - Registro de cambios

**Contiene:**

- 🔧 Historial de todos los fixes aplicados
- 📝 Análisis de causa raíz de cada problema
- 💡 Lecciones aprendidas
- 🎯 Plantilla para documentar nuevos fixes

**Cuándo usar:**

- Después de resolver cualquier bug
- Para documentar cambios importantes
- Como referencia si el mismo error aparece de nuevo
- Para onboarding de nuevos developers

**Ejemplo de uso:**

```markdown
## Fix #002 - Subir Archivos Grandes Falla

**Fecha:** 2026-04-15 10:00
**Severidad:** 🔴 CRÍTICO
**Estado:** ✅ RESUELTO

### Descripción del Problema

Archivos > 100MB fallan con timeout

### Causa Raíz

Límite de bodyParser muy bajo

### Solución

Aumentar limit en express.json()

### Archivos Modificados

- apps/api/src/index.ts

### Testing Post-Fix

- [x] Subir archivo de 150MB → Funciona
```

---

## 🤖 Script de Testing Automatizado

### `tests/test-funcionalidades.sh`

Script bash que ejecuta **smoke tests** automáticos de funcionalidades críticas.

#### ¿Qué testea?

✅ **Infraestructura:**

- PostgreSQL corriendo
- Redis corriendo
- Tablas de base de datos existen
- Conexión a Redis OK

✅ **Servicios Web:**

- API health check
- Frontend accesible
- Procesos Node.js activos

✅ **Autenticación:**

- Login redirect funciona
- Endpoint `/api/auth/me` responde

✅ **Configuración:**

- Archivos `.env` existen
- Variables críticas configuradas

#### Cómo ejecutar:

```bash
# Desde la raíz del proyecto
./tests/test-funcionalidades.sh
```

#### Output esperado:

```
╔════════════════════════════════════════════════════════════════╗
║     DOM BIM Platform - Smoke Tests Automatizados             ║
╚════════════════════════════════════════════════════════════════╝

─────────────────────────────────────────────────────────────────
  📦 INFRAESTRUCTURA
─────────────────────────────────────────────────────────────────
[✓] PostgreSQL está corriendo
[✓] Redis está corriendo
[✓] Conexión a PostgreSQL: OK
[✓] Base de datos tiene 25 tablas
...

╔════════════════════════════════════════════════════════════════╗
║                         RESUMEN                                ║
╚════════════════════════════════════════════════════════════════╝

  Total de tests:    18
  Pasados:          18
  Fallidos:         0

✓ TODOS LOS TESTS PASARON

  ┌─────────────────────────────────────────────────────────────┐
  │  Sistema listo para testing manual de funcionalidades      │
  │  Abre: http://localhost:3001                                │
  └─────────────────────────────────────────────────────────────┘
```

#### Logs:

Los logs se guardan en `/tmp/dom-bim-test-TIMESTAMP.log` para revisión posterior.

---

## 🎯 Workflow Recomendado

### 1. **Antes de Empezar el Día**

```bash
# 1. Arrancar servicios
cd ~/Proyecto-DOM
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
npx concurrently -k -n "API,WRK,WEB" \
  "npm run dev:api" \
  "npm run dev:worker" \
  "npm run dev:frontend"

# 2. Ejecutar smoke tests
./tests/test-funcionalidades.sh

# 3. Abrir checklist del día
code docs/CHECKLIST_TESTING.md
```

### 2. **Durante el Testing**

Para cada funcionalidad:

1. **Consultar** `AUDITORIA_FUNCIONALIDADES.md` para entender qué testear
2. **Ejecutar** las pruebas manualmente siguiendo los casos de prueba
3. **Documentar** resultados directamente en el documento:

   ```markdown
   **✅ Resultado de prueba:**

   - **Fecha:** 2026-04-15 10:30
   - **Usuario testeado:** chirinosebastianmn@gmail.com
   - **Resultado:** Exitoso
   - **Observaciones:** Subida de archivo RVT de 50MB funciona perfectamente
   ```

4. **Si encuentras un error:**
   - Tomar screenshot (guardar en `docs/assets/errors/`)
   - Copiar logs relevantes
   - Abrir `REGISTRO_FIXES.md`
   - Crear nuevo fix usando la plantilla

5. **Actualizar checklist:**
   ```markdown
   - [x] **Subir archivos** - ✅ COMPLETADO (2026-04-15)
   ```

### 3. **Al Final del Día**

```bash
# 1. Commit de cambios en documentos
git add docs/
git commit -m "docs: actualizar auditoría de funcionalidades - día 1"

# 2. Hacer backup de logs
cp /tmp/dom-bim-test-*.log docs/logs/

# 3. Actualizar resumen ejecutivo en AUDITORIA_FUNCIONALIDADES.md
```

---

## 📊 Estructura de Archivos

```
Proyecto-DOM/
├── docs/
│   ├── AUDITORIA_FUNCIONALIDADES.md   ← Documento maestro
│   ├── CHECKLIST_TESTING.md            ← Tracking diario
│   ├── REGISTRO_FIXES.md               ← Historial de fixes
│   ├── README_AUDITORIA.md             ← Este archivo
│   ├── logs/                           ← Logs de testing
│   │   └── test-2026-04-14.log
│   └── assets/
│       └── errors/                     ← Screenshots de errores
│           └── error-upload-001.png
├── tests/
│   └── test-funcionalidades.sh         ← Script automatizado
└── ...
```

---

## 🏆 Buenas Prácticas

### ✅ DO (Hacer)

- **Sé específico** en las descripciones de errores
- **Incluye logs** relevantes, no todo el output
- **Documenta pasos** exactos para reproducir
- **Actualiza el estado** inmediatamente después de testear
- **Usa la plantilla** para mantener consistencia
- **Commit frecuente** de cambios en docs

### ❌ DON'T (No hacer)

- No marques como "testeado" sin prueba real
- No omitas documentar errores encontrados
- No copies/pegues logs de 1000 líneas (filtra lo relevante)
- No testees sin tener los servicios corriendo
- No asumas que algo funciona porque "debería"

---

## 🔍 Tips de Testing

### 1. **Testing de Happy Path**

Primero verifica el "camino feliz" - lo que debería funcionar sin problemas.

```
Ejemplo: Subir archivo
1. Archivo válido (RVT, < 200MB)
2. Proyecto existe
3. Usuario tiene permisos
→ ✅ Debe funcionar
```

### 2. **Testing de Edge Cases**

Después prueba casos límite y errores esperados.

```
Ejemplo: Subir archivo
1. Archivo > 200MB → Debe rechazar con mensaje claro
2. Archivo .exe → Debe rechazar por extensión
3. Proyecto no existe → Debe dar 404
4. Usuario sin permisos → Debe dar 403
```

### 3. **Testing de Integración**

Verifica que componentes funcionan juntos.

```
Ejemplo: Flujo completo
1. Subir archivo RVT
2. Esperar conversión automática
3. Abrir en viewer 3D
4. Ejecutar validación
5. Ver resultados
→ Todo el flow debe completarse sin errores
```

### 4. **Testing de Performance**

Verifica tiempos de respuesta aceptables.

```
Ejemplo: Tiempo aceptado
- Subir archivo 50MB: < 30 segundos
- Listar proyectos: < 2 segundos
- Abrir viewer: < 5 segundos
```

---

## 🆘 Troubleshooting

### "No puedo ejecutar el script"

```bash
chmod +x tests/test-funcionalidades.sh
```

### "Docker no está corriendo"

```bash
# Windows: Abrir Docker Desktop
# Verificar:
docker ps
```

### "Tests fallan pero la app funciona"

El script es sensible. Revisa los logs en `/tmp/dom-bim-test-*.log` para ver el detalle.

### "No sé por dónde empezar"

Sigue el orden de prioridades en `AUDITORIA_FUNCIONALIDADES.md`:

1. 🔴 CRÍTICO primero
2. 🟡 ALTO después
3. 🟢 MEDIO/BAJO al final

---

## 📞 Contacto y Soporte

Si tienes dudas sobre cómo usar este sistema:

1. Revisa este README completo
2. Consulta los documentos de ejemplo
3. Revisa el first fix documentado en `REGISTRO_FIXES.md`

---

## 🎉 ¡Listo para Empezar!

```bash
# Paso 1: Arrancar sistema
npm run dev

# Paso 2: Ejecutar smoke tests
./tests/test-funcionalidades.sh

# Paso 3: Abrir documentación
code docs/AUDITORIA_FUNCIONALIDADES.md

# Paso 4: Empezar testing 🚀
```

**¡Éxito en tu auditoría!** 🎯
