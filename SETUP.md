# 🚀 DOM BIM Platform - Guía de Instalación

Guía completa para instalar, configurar y ejecutar la plataforma DOM BIM.

---

## 📋 Requisitos Previos

### Software Requerido

- **Node.js** >= 18.0.0 ([Descargar](https://nodejs.org/))
- **npm** >= 9.0.0 (incluido con Node.js)
- **Git** ([Descargar](https://git-scm.com/))
- **Redis** (Ver sección [Instalación de Redis](#instalación-de-redis))

### Cuentas Necesarias

- **Autodesk Platform Services (APS)** - [Crear cuenta](https://aps.autodesk.com/)
  - Necesitarás: Client ID, Client Secret
  - Configurar Callback URL en la consola de APS

### Opcional (Recomendado para Producción)

- **AWS S3** - Para almacenamiento de archivos en la nube
- **Docker** - Para ejecutar Redis y otros servicios

---

## 📥 Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/SebastianChM/Proyecto-DOM.git
cd Proyecto-DOM
```

### 2. Instalar Dependencias

#### Backend (API)
```bash
cd api
npm install
```

#### Frontend
```bash
cd ../frontend
npm install
```

#### Raíz (scripts globales)
```bash
cd ..
npm install
```

### 3. Configuración de Base de Datos

La plataforma utiliza **SQLite** para desarrollo y **PostgreSQL** (recomendado) para producción.

#### Generar Prisma Client
```bash
npx prisma generate --schema=./prisma/schema.prisma
```

#### Crear la Base de Datos
```bash
npx prisma migrate dev --schema=./prisma/schema.prisma --name init
```

Esto creará el archivo `prisma/dev.db` con todas las tablas necesarias.

---

## ⚙️ Configuración

### 1. Variables de Entorno

Copia el archivo de ejemplo y edítalo con tus credenciales:

```bash
cp .env.example .env
```

### 2. Configuración Detallada de Variables

Edita el archivo `.env` con los siguientes valores:

#### 🗄️ Base de Datos
```env
DATABASE_URL="file:./dev.db"  # SQLite para desarrollo
# DATABASE_URL="postgresql://user:password@localhost:5432/dom_bim"  # PostgreSQL para producción
```

#### 🔐 Autodesk Platform Services (APS)

1. Ve a [APS Developer Portal](https://aps.autodesk.com/)
2. Crea una nueva aplicación
3. Copia las credenciales:

```env
APS_CLIENT_ID=tu_client_id_aqui
APS_CLIENT_SECRET=tu_client_secret_aqui
APS_CALLBACK_URL=http://localhost:8080/api/auth/callback
APS_BUCKET=nombre-unico-bucket-aps
```

⚠️ **Importante**: El `APS_BUCKET` debe ser único globalmente. Recomendado: `tu-empresa-bim-platform-[region]-[ambiente]`

#### 🔑 Seguridad - Session Secrets

Genera secrets seguros (mínimo 32 caracteres):

```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

```env
SESSION_SECRET=tu_secret_generado_aqui
NEXTAUTH_SECRET=otro_secret_diferente_aqui
```

#### 🌐 URLs de la Aplicación

```env
# Backend
API_PORT=8080
NODE_ENV=development

# Frontend
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080
```

#### 📦 Redis (Requerido)

```env
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### ☁️ AWS S3 (Opcional - para producción)

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_S3_BUCKET=tu-bucket-s3
```

---

## 🐳 Instalación de Redis

Redis es **REQUERIDO** para las funcionalidades de:
- Cache de datos (Hito 1, 2)
- Colas de procesamiento (Hito 3, 5)
- Sincronización automática (Hito 3)
- Rate limiting avanzado (Hito 7)

### Opción 1: Docker (Recomendado)

```bash
# Iniciar Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Verificar que está corriendo
docker ps | grep redis
```

### Opción 2: Windows - Memurai

[Memurai](https://www.memurai.com/) es un port oficial de Redis para Windows:

1. Descargar desde [memurai.com/get-memurai](https://www.memurai.com/get-memurai)
2. Instalar el .msi
3. Iniciar servicio: `net start Memurai`

### Opción 3: WSL2 (Windows Subsystem for Linux)

```bash
# Instalar WSL2 si no lo tienes
wsl --install

# Dentro de WSL
sudo apt update
sudo apt install redis-server

# Iniciar Redis
sudo service redis-server start

# Verificar
redis-cli ping  # Debe responder: PONG
```

### Opción 4: Cloud Redis (Desarrollo)

Para desarrollo rápido sin instalación local:

- **Upstash Redis**: [upstash.com](https://upstash.com/) (Plan gratuito disponible)
- **Redis Labs**: [redis.com/try-free](https://redis.com/try-free/)

Actualiza la variable `REDIS_URL` con la URL proporcionada:
```env
REDIS_URL=rediss://default:password@your-instance.upstash.io:6379
```

### Verificar Instalación de Redis

```bash
# Linux/macOS/WSL
redis-cli ping

# Windows (Memurai)
memurai-cli ping

# Debe responder: PONG
```

---

## 🚀 Ejecución

### Modo Desarrollo

#### Terminal 1: Backend
```bash
cd api
npm run dev
```

La API estará disponible en: **http://localhost:8080**

#### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

La aplicación estará disponible en: **http://localhost:3000**

### Modo Producción

#### Backend
```bash
cd api
npm run build
npm start
```

#### Frontend
```bash
cd frontend
npm run build
npm start
```

---

## ✅ Verificación de Instalación

### 1. Verificar API

```bash
# Health check
curl http://localhost:8080/health

# Respuesta esperada:
# {"status":"ok","timestamp":"2025-12-02T..."}
```

### 2. Verificar Variables de Entorno

```bash
curl http://localhost:8080/debug/aps-config

# Respuesta esperada:
# {
#   "hasClientId": true,
#   "hasClientSecret": true,
#   "callbackUrl": "http://localhost:8080/api/auth/callback",
#   "clientIdPreview": "RIi0BvKIEf...",
#   "bucket": "dom-bim-platform-us-test-001"
# }
```

### 3. Verificar Frontend

Abre http://localhost:3000 en tu navegador. Deberías ver la página de inicio.

### 4. Verificar Autenticación

1. Ve a http://localhost:3000
2. Click en "Iniciar Sesión"
3. Deberías ser redirigido a Autodesk login
4. Después de iniciar sesión, vuelves al dashboard

### 5. Verificar Redis

```bash
# Desde la terminal
redis-cli ping
# Respuesta: PONG

# O verifica en logs del API:
# ✅ Redis configured at: localhost:6379
```

---

## 🔧 Solución de Problemas

### Problema: "EADDRINUSE: Port 8080 already in use"

**Solución**:
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force

# Linux/macOS
lsof -ti:8080 | xargs kill -9
```

### Problema: "Prisma Client did not initialize yet"

**Solución**:
```bash
npx prisma generate --schema=./prisma/schema.prisma
```

### Problema: "Redis connection refused"

**Causas posibles**:
1. Redis no está iniciado
2. Puerto incorrecto
3. Firewall bloqueando conexión

**Solución**:
```bash
# Verificar que Redis está corriendo
redis-cli ping

# Si no responde, iniciar Redis:
# Docker
docker start redis

# WSL
sudo service redis-server start

# Windows (Memurai)
net start Memurai
```

### Problema: "APS Authentication Failed"

**Causas posibles**:
1. Credenciales incorrectas
2. Callback URL no coincide

**Solución**:
1. Verificar `APS_CLIENT_ID` y `APS_CLIENT_SECRET` en `.env`
2. Verificar que `APS_CALLBACK_URL` coincide con la configurada en APS Portal
3. En desarrollo, asegurar que el callback es: `http://localhost:8080/api/auth/callback`

### Problema: "CORS Error" desde el frontend

**Causa**: Frontend en puerto diferente no permitido

**Solución**: Verificar que en `api/src/config/cors.config.ts` incluye:
```typescript
'http://localhost:3000'  // Puerto del frontend
```

### Problema: Base de Datos bloqueada

**Solución**:
```bash
# Cerrar todos los procesos Node
taskkill /F /IM node.exe  # Windows
pkill -9 node              # Linux/macOS

# Reiniciar
cd api
npm run dev
```

---

## 📚 Documentación Adicional

### API Documentation

Una vez iniciada la API, accede a:
- **Swagger UI**: http://localhost:8080/api-docs

### Estructura del Proyecto

```
Proyecto-DOM/
├── api/                    # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── config/        # Configuraciones (CORS, Rate Limit, etc.)
│   │   ├── middleware/    # Middlewares (Auth, etc.)
│   │   ├── routes/        # Rutas de API
│   │   ├── services/      # Lógica de negocio
│   │   └── types/         # Tipos TypeScript
│   └── package.json
├── frontend/              # Frontend (Next.js 16 + React 19)
│   ├── app/              # App Router de Next.js
│   ├── components/       # Componentes React
│   └── package.json
├── prisma/               # Schema y migraciones de DB
│   ├── schema.prisma
│   └── migrations/
├── .env                  # Variables de entorno (NO commitear)
├── .env.example          # Plantilla de variables
└── package.json          # Dependencias raíz
```

### Scripts Disponibles

#### Backend (`api/`)
```bash
npm run dev          # Modo desarrollo con hot reload
npm run build        # Compilar TypeScript
npm start            # Ejecutar build de producción
npm run prisma:generate   # Regenerar Prisma Client
```

#### Frontend (`frontend/`)
```bash
npm run dev          # Modo desarrollo
npm run build        # Build de producción
npm start            # Ejecutar build de producción
npm run lint         # Linter ESLint
```

---

## 🔐 Seguridad

### Checklist de Seguridad

- [ ] Cambiar `SESSION_SECRET` a un valor aleatorio de 32+ caracteres
- [ ] Cambiar `NEXTAUTH_SECRET` a un valor diferente
- [ ] NO commitear archivos `.env` al repositorio
- [ ] En producción, usar HTTPS para todas las URLs
- [ ] Configurar CORS solo para dominios confiables
- [ ] Revisar rate limiting en `api/src/config/rate-limit.config.ts`
- [ ] Usar PostgreSQL en producción (no SQLite)
- [ ] Configurar firewall para Redis (no exponer públicamente)

---

## 🎯 Próximos Pasos

Una vez instalado correctamente:

1. **Lee la documentación del proyecto**: `PROJECT_DOCUMENTATION.md`
2. **Revisa el plan de implementación**: `PLAN_PROFESIONALIZACION.md`
3. **Configura tu entorno de desarrollo**: IDE, extensiones, etc.
4. **Familiarízate con la arquitectura**: Ver `AUDITORIA_PRE_IMPLEMENTACION.md`

---

## 🆘 Soporte

### Recursos

- **Documentación APS**: [aps.autodesk.com/developer/overview](https://aps.autodesk.com/developer/overview)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Prisma Docs**: [prisma.io/docs](https://www.prisma.io/docs)

### Contacto

Para problemas específicos del proyecto:
- Revisar issues en el repositorio
- Contactar al equipo de desarrollo

---

## 📝 Notas Finales

### Para Desarrollo Local

- La configuración actual utiliza **SQLite** para facilitar el desarrollo
- Redis es opcional para testing básico, pero **requerido** para Hitos 1-8
- Los archivos se almacenan localmente en `api/uploads/`

### Para Producción

- Migrar a **PostgreSQL** (actualizar `DATABASE_URL`)
- Configurar **AWS S3** para almacenamiento de archivos
- Usar **Redis** en instancia dedicada o cloud
- Configurar **HTTPS** con certificados SSL/TLS
- Revisar y ajustar rate limits según carga esperada
- Configurar monitoreo (logs, métricas, alertas)

---

**¡Instalación completada! 🎉**

La plataforma está lista para desarrollo. Consulta `TODO.md` para las tareas pendientes.
