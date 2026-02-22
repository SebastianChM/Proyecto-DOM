# DOM BIM Platform

**Enterprise-grade BIM management platform** con soporte multi-formato (RVT, DWG, PDF, IFC, NWC) y capacidades avanzadas de comparación y validación.

## 🏗️ Arquitectura

```text
├── apps/
│   ├── api/              # Express + TypeScript backend
│   └── web/              # Next.js 14 frontend
├── packages/
│   └── database/         # Prisma schema y migraciones
├── infra/
│   └── docker/           # Docker Compose configs
├── tools/
│   └── scripts/          # Utility scripts
└── docs/                 # Project documentation
```

## 🚀 Quick Start (3 Comandos)

### Requisitos

- Node.js 20.11.0 (usa `nvm use` si tienes nvm)
- Docker Desktop instalado y corriendo

### Setup Inicial

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar infraestructura (PostgreSQL + Redis) y generar Prisma
npm run dev:infra && npm run dev:wait && npm run db:generate

# 3. Correr migraciones e iniciar desarrollo
npm run db:migrate && npm run dev
```

**¡Listo!**

- **API**: <http://localhost:8080>
- **Frontend**: <http://localhost:3000>
- **Prisma Studio**: `npm run db:studio`

## 📦 Features Implementadas

### Core

- ✅ PostgreSQL + Prisma ORM
- ✅ Redis para cache, sesiones y rate limiting
- ✅ Express API con TypeScript
- ✅ Next.js 14 Frontend con App Router
- ✅ Docker setup completo
- ✅ Rate limiting por endpoint
- ✅ Session management con Redis
- ✅ Error handling centralizado
- ✅ CORS restrictivo y configurable
- ✅ Validación de env al arranque

### Autodesk Platform Services (APS)

- ✅ OAuth 2.0 Authentication
- ✅ File upload a APS OSS
- ✅ Model Derivative (conversión)
- ✅ Design Automation workflows
- ✅ Webhooks de conversión
- ✅ APS Viewer integrado

### Advanced Features

- ✅ Model comparison (RVT vs RVT)
- ✅ PDF vs Model comparison
- ✅ BOM extraction
- ✅ Compliance validation
- ✅ Workflow engine
- ✅ Real-time notifications (Socket.IO)

## 🔧 Tecnologías

**Backend**:

- Node.js 20 + TypeScript
- Express.js
- Prisma + PostgreSQL
- Bull + Redis (queues)
- APS SDK
- Socket.IO

**Frontend**:

- Next.js 14 (App Router)
- shadcn/ui + Tailwind CSS
- APS Viewer SDK
- React Query

**DevOps**:

- Docker + Docker Compose
- PostgreSQL 15
- Redis 7

## 📝 Scripts Disponibles

### Desarrollo

```bash
npm run dev              # Inicia todo el stack (infra + API + worker + frontend)
npm run dev:api          # Solo API
npm run dev:worker       # Solo worker de conversiones
npm run dev:frontend     # Solo frontend
npm run dev:stop         # Detiene todos los servicios
```

### Base de Datos

```bash
npm run db:generate      # Genera Prisma client
npm run db:migrate       # Corre migraciones pendientes
npm run db:studio        # Abre Prisma Studio
npm run db:reset         # Reset completo (⚠️ borra datos)
```

### Infraestructura

```bash
npm run dev:infra        # Levanta PostgreSQL + Redis
npm run infra:up         # Alias de dev:infra
npm run infra:down       # Detiene contenedores
npm run infra:status     # Verifica estado de servicios
```

### Calidad de Código

```bash
npm run lint             # Ejecuta ESLint
npm run format           # Formatea código con Prettier
npm run typecheck        # Verifica tipos TypeScript
npm run security:scan    # Escaneo de seguridad
```

## 🔐 Variables de Entorno

Copia `.env.example` a `.env` y actualiza los valores:

```bash
cp .env.example .env
```

### Variables Críticas (Requeridas)

```env
# Autodesk Platform Services
APS_CLIENT_ID="your_client_id"
APS_CLIENT_SECRET="your_client_secret"
APS_CALLBACK_URL="http://localhost:8080/api/auth/callback"

# Seguridad
SESSION_SECRET="<GENERATE_RANDOM_32_CHARS>"
WEBHOOK_SECRET="<GENERATE_RANDOM_32_CHARS>"

# Base de Datos (auto-configurado si usas Docker)
DATABASE_URL="postgresql://dom:your_password@localhost:5432/dom_bim"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

Ver `.env.example` para lista completa con descripciones.

## 🆘 Troubleshooting

### Base de datos no conecta

```bash
npm run infra:down
npm run infra:up
npm run db:migrate
```

### Puerto en uso

Cambiar `PORT` en `.env` (default: 8080 para API, 3000 para frontend)

### Redis no disponible

```bash
docker ps  # Verificar que Redis está corriendo
npm run infra:up
```

### Limpiar y reiniciar

```bash
npm run dev:stop        # Detiene servicios
npm run infra:down      # Baja contenedores
rm -rf node_modules     # Borra node_modules
npm install             # Reinstala
npm run dev:infra       # Levanta infra
npm run db:generate     # Regenera Prisma
npm run dev             # Inicia todo
```

## 📚 Documentación Adicional

- `docs/setup/` - Guías de instalación y configuración
- `docs/api/` - Documentación de API
- `.env.example` - Referencia completa de variables

## 🔒 Seguridad

Este proyecto implementa:

- ✅ Rate limiting por IP y usuario
- ✅ CORS restrictivo (sin wildcards)
- ✅ Validación de variables de entorno al arranque
- ✅ Sesiones con Redis (no cookies vulnerables)
- ✅ CSRF protection
- ✅ Helmet.js headers de seguridad
- ✅ Input validation con Zod
- ✅ No hardcoded secrets

---

**Desarrollado para Sebastian Chirino** | Versión 2.0.0 | Node.js 20.11.0
