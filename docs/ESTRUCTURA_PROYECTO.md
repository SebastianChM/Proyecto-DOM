# Estructura del Proyecto - DOM BIM Platform

## Árbol de Directorios Principal

```
Proyecto DOM/
├── .gemini/                          # Configuración de AI
├── .git/                             # Control de versiones Git
├── api/                              # Backend API (Node.js/Express)
│   ├── prisma/                       # ORM y base de datos
│   ├── src/
│   │   ├── config/                   # Configuración (CORS, rate limit, env, etc.)
│   │   ├── controllers/              # Controladores de endpoints
│   │   ├── interfaces/               # TypeScript interfaces
│   │   ├── middleware/               # Middleware de Express
│   │   ├── routes/                   # Definición de rutas API
│   │   ├── services/                 # Lógica de negocio
│   │   │   ├── aps/                  # Autodesk Platform Services
│   │   │   ├── compliance/           # Motor de cumplimiento normativo
│   │   │   ├── conversion/           # Conversión de archivos
│   │   │   ├── notifications/        # Sistema de notificaciones
│   │   │   └── workflow/             # Motor de flujos de trabajo
│   │   ├── types/                    # Type definitions
│   │   ├── utils/                    # Utilidades
│   │   ├── workers/                  # Background workers
│   │   └── index.ts                  # Entry point
│   ├── tools/                        # Herramientas CLI
│   ├── uploads/                      # Archivos subidos
│   ├── .env                          # Variables de entorno (gitignored)
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                             # Documentación del proyecto
│   ├── audits/                       # Auditorías y reports
│   ├── deploy/                       # Guías de deployment
│   │   ├── BACKUPS.md
│   │   ├── DEPLOY.md
│   │   └── PRE_DEPLOYMENT_SECURITY.md
│   ├── security/                     # Documentación de seguridad
│   │   ├── SECURITY_OVERVIEW.md
│   │   └── ...
│   ├── GUIA_DOCKER_Y_TESTS.md
│   ├── HITO1_ENTREGA_FINAL.md
│   ├── hito1_backup_system.md
│   ├── hito1_evidencia_cierre.md
│   ├── hito1_test_results_security.md
│   ├── INSTRUCCIONES_FINALES_CONFIDENCIAL.md
│   ├── PROJECT_CONTEXT.md
│   └── ...
│
├── frontend/                         # Frontend (Next.js/React)
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API routes de Next.js
│   │   ├── auth/                     # Páginas de autenticación
│   │   ├── compliance/               # Módulo de cumplimiento
│   │   ├── files/                    # Gestión de archivos
│   │   ├── projects/                 # Proyectos y modelos
│   │   ├── workflows/                # Flujos de trabajo
│   │   └── layout.tsx
│   ├── components/                   # Componentes React
│   │   ├── compliance/               # Componentes de cumplimiento
│   │   ├── projects/                 # Componentes de proyectos
│   │   ├── ui/                       # Componentes UI base
│   │   ├── workflows/                # Componentes de workflows
│   │   └── ...
│   ├── contexts/                     # React Contexts
│   ├── hooks/                        # Custom React hooks
│   ├── lib/                          # Librerías y utilidades
│   ├── public/                       # Assets estáticos
│   ├── stores/                       # State management (Zustand)
│   ├── types/                        # TypeScript types
│   ├── .env.local                    # Variables de entorno (gitignored)
│   ├── next.config.mjs
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── node_modules/                     # Dependencias (gitignored)
│
├── PDFs Chile/                       # Documentos de referencia
│   └── ...volúmenes normativos
│
├── Plan GPT/                         # Planificación del proyecto
│   └── Plan de Desarrollo – Plataforma BIM DOM.pdf
│
├── prisma/                           # Base de datos (SQLite/PostgreSQL)
│   ├── migrations/                   # Migraciones de BD
│   ├── backups/                      # Backups de la BD
│   ├── dev.db                        # BD de desarrollo
│   ├── schema.prisma                 # Esquema de Prisma
│   └── seed-*.ts                     # Scripts de seed
│
├── scripts/                          # Scripts de utilidad
│   ├── backup-db.js                  # Backup de base de datos
│   ├── security-scan.js              # Escaneo de seguridad
│   ├── test-hito1-security.sh        # Tests de seguridad
│   ├── repomix-hito1.js              # Generación de contexto
│   └── ...
│
├── test-documents/                   # Documentos de prueba
│   └── ET-*.txt
│
├── .env                              # Variables de entorno raíz
├── .env.example                      # Ejemplo de configuración
├── .gitignore
├── docker-compose.yml                # Configuración Docker
├── eslint.config.mjs                 # Configuración ESLint
├── HITO0_CONTEXT.md                  # Contexto Hito 0
├── HITO1_CONTEXT.md                  # Contexto Hito 1
├── package.json                      # Configuración raíz
├── PROJECT_CONTEXT.md                # Contexto general del proyecto
├── README.md
└── tsconfig.json                     # TypeScript config raíz
```

## Archivos Principales por Categoría

### Configuración

- `.env` / `.env.example` - Variables de entorno
- `docker-compose.yml` - Servicios Docker (PostgreSQL, Redis)
- `package.json` - Dependencias y scripts
- `tsconfig.json` - Configuración TypeScript
- `eslint.config.mjs` - Linting

### Backend (`api/`)

- `src/index.ts` - Entry point del servidor
- `src/config/env.ts` - Validación de variables de entorno
- `src/config/cors.config.ts` - Configuración CORS
- `src/config/rate-limit.config.ts` - Rate limiting
- `src/routes/` - Endpoints API
- `src/services/` - Lógica de negocio
- `src/middleware/` - Middleware personalizado

### Frontend (`frontend/`)

- `app/layout.tsx` - Layout principal
- `app/page.tsx` - Página de inicio
- `components/` - Componentes reutilizables
- `hooks/` - Custom React hooks
- `stores/` - Zustand stores (state management)

### Base de Datos

- `prisma/schema.prisma` - Esquema de datos
- `prisma/migrations/` - Versionado de BD
- `prisma/dev.db` - SQLite para desarrollo

### Documentación

- `docs/PROJECT_CONTEXT.md` - Contexto del proyecto
- `docs/security/` - Documentación de seguridad
- `docs/deploy/` - Guías de deployment
- `docs/hito*.md` - Documentación de hitos

### Scripts

- `scripts/backup-db.js` - Backup automatizado
- `scripts/security-scan.js` - Escaneo de seguridad
- `scripts/test-hito1-security.sh` - Tests seguridad

## Estadísticas del Proyecto

**Total aproximado de archivos (sin node_modules):**

- ~150-200 archivos de código fuente
- ~30 archivos de documentación
- ~20 archivos de configuración
- ~10 PDFs de referencia

**Líneas de código aproximadas:**

- Backend (TypeScript): ~15,000 líneas
- Frontend (TypeScript/React): ~20,000 líneas
- Documentación (Markdown): ~5,000 líneas
- Total: ~40,000 líneas

**Tecnologías principales:**

- Node.js + Express + TypeScript
- Next.js + React + Tailwind CSS
- PostgreSQL + Prisma ORM
- Redis (rate limiting, caching)
- Socket.IO (real-time)
- Autodesk Platform Services (APS)
- Docker + Docker Compose

---

**Última actualización:** 2025-12-20  
**Estado:** HITO 1 completado al 100%
