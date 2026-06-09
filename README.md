# DOM BIM Platform

> Enterprise BIM management platform with multi-format support (RVT, DWG, PDF, IFC, NWC) and advanced comparison and validation pipelines on top of Autodesk Platform Services.

[![Node 20.11+](https://img.shields.io/badge/Node-20.11+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![APS](https://img.shields.io/badge/Autodesk-Platform%20Services-FF6B00?style=for-the-badge&logo=autodesk&logoColor=white)](https://aps.autodesk.com/)
[![License Proprietary](https://img.shields.io/badge/license-proprietary-A8C95A?style=for-the-badge)](LICENSE)

---

## What it does

The DOM BIM Platform is an enterprise system that ingests Building Information Modeling files (`.rvt`, `.dwg`, `.pdf`, `.ifc`, `.nwc`), converts them to the Autodesk Platform Services (APS) Viewer format, and exposes a workflow engine for comparison, validation, bill-of-materials extraction, and compliance checks against engineering specifications.

It is built as a TypeScript monorepo with three services running together: an Express API that handles authentication, file uploads, and APS integration; a background worker (Bull on Redis) that processes long-running model conversions and comparisons; and a Next.js 14 frontend with the APS Viewer embedded for interactive 3D model inspection.

The platform was designed for Sebastian Chirino's BIM operations team to replace a fragmented stack of manual workflows with a single web-based system where every model conversion, comparison, and validation is traceable, auditable, and reproducible.

## Architecture

```
+-----------------------------+      +-----------------------------+
|   Next.js 14 frontend       |<---->|   Express API (TypeScript)  |
|   - APS Viewer embedded     |      |   - OAuth + sessions        |
|   - shadcn/ui + Tailwind    |      |   - REST + Socket.IO        |
|   - React Query             |      |   - Zod input validation    |
+-----------------------------+      +--------------+--------------+
                                                    |
                                                    v
                          +-------------------------+--------------------------+
                          |                                                   |
                +---------+----------+                       +----------------+----------+
                |   PostgreSQL 15    |                       |   Redis 7                 |
                |   (Prisma ORM)     |                       |   - Bull job queues       |
                |   - Models         |                       |   - Sessions              |
                |   - Audit log      |                       |   - Rate limiting cache   |
                +--------------------+                       +---------------------------+
                                                    |
                                                    v
                                    +---------------+----------------+
                                    |   APS Worker (Bull consumer)   |
                                    |   - Model Derivative           |
                                    |   - Design Automation          |
                                    |   - File upload to OSS         |
                                    +--------------------------------+
                                                    |
                                                    v
                                    +--------------------------------+
                                    |   Autodesk Platform Services   |
                                    |   - OAuth 2.0                  |
                                    |   - OSS storage                |
                                    |   - Model Derivative engine    |
                                    |   - Design Automation          |
                                    +--------------------------------+
```

- **API service** (`apps/api`) — REST endpoints, OAuth flows, session management, webhook handlers, Socket.IO server for real-time notifications.
- **Web service** (`apps/web`) — Next.js 14 App Router frontend with the APS Viewer SDK embedded and shadcn/ui components.
- **Worker service** (same codebase as API, separate process) — Bull queue consumers that handle APS model conversions, comparisons, and BOM extractions asynchronously.
- **Database package** (`packages/database`) — Prisma schema, migrations, and a generated typed client shared between API and worker.

## Core capabilities

### Authentication and infrastructure

- OAuth 2.0 integration with Autodesk Platform Services
- Session management backed by Redis with HttpOnly cookies
- Per-route rate limiting with separate buckets for IP and authenticated user
- Helmet.js security headers, restrictive CORS without wildcards
- Environment validation on boot (the API refuses to start if required variables are missing)
- Centralized error handler that maps domain errors to HTTP responses

### File ingestion and conversion

- Multi-format upload to APS Object Storage Service (OSS)
- Model Derivative pipeline for `.rvt`, `.dwg`, `.ifc`, `.nwc` translation
- PDF ingestion with metadata extraction
- Webhook receiver for conversion completion callbacks
- APS Viewer integration for interactive 3D inspection in the browser

### Workflow engine

- Revit-to-Revit model comparison with diff visualization
- PDF-to-model comparison for spec-vs-implementation validation
- Bill of Materials extraction from converted models
- Compliance validation against rule sets
- Real-time progress notifications over Socket.IO

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript (strict) |
| Runtime | Node.js 20.11+ |
| Backend framework | Express |
| Frontend framework | Next.js 14 (App Router) |
| UI library | shadcn/ui + Tailwind CSS |
| Database | PostgreSQL 15 with Prisma ORM |
| Cache and queues | Redis 7 with Bull |
| BIM platform | Autodesk Platform Services (APS) |
| Real-time | Socket.IO |
| Validation | Zod |
| Data fetching | React Query |
| Auth | OAuth 2.0 + Redis-backed sessions |
| Lint and format | ESLint + Prettier + lint-staged + Husky |
| Containers | Docker + Docker Compose |
| Package manager | npm workspaces (monorepo) |

## Quickstart

```bash
# 1. Install dependencies (npm workspaces)
npm install

# 2. Bring up infrastructure (PostgreSQL + Redis), wait for it,
#    and generate the Prisma client
npm run dev:infra && npm run dev:wait && npm run db:generate

# 3. Apply migrations and start API + worker + frontend
npm run db:migrate && npm run dev
```

Default endpoints:

- API: `http://localhost:8080`
- Frontend: `http://localhost:3000`
- Prisma Studio: `npm run db:studio`

## Project structure

```
dom-bim-platform/
├── apps/
│   ├── api/                # Express + TypeScript backend, REST + Socket.IO + worker
│   └── web/                # Next.js 14 frontend with APS Viewer embedded
├── packages/
│   ├── database/           # Prisma schema, migrations, generated client
│   └── z-schema-patched/   # Patched zod schema utilities (internal)
├── infra/
│   └── docker/             # docker-compose for PostgreSQL 15 + Redis 7
├── tools/
│   └── scripts/            # Dev orchestration (start-service, infra status, env sync)
├── docs/                   # Setup guides, API docs, architecture notes
├── .env.example            # Reference for all environment variables
├── eslint.config.mjs
├── package.json            # Root workspace manifest with shared scripts
└── README.md
```

## Development scripts

### Running services

```bash
npm run dev            # Full stack: infra + API + worker + frontend
npm run dev:api        # API only
npm run dev:worker     # Bull queue consumer only
npm run dev:frontend   # Frontend only
npm run dev:stop       # Stop everything
```

### Database

```bash
npm run db:generate    # Regenerate Prisma client from schema
npm run db:migrate     # Apply pending migrations
npm run db:studio      # Launch Prisma Studio at http://localhost:5555
```

### Infrastructure

```bash
npm run dev:infra      # Start PostgreSQL + Redis (Docker)
npm run infra:up       # Alias for dev:infra
npm run infra:down     # Stop containers
npm run infra:status   # Inspect container health
```

### Quality gates

```bash
npm run lint           # ESLint across all workspaces
npm run format         # Prettier write
npm run typecheck      # tsc --noEmit on api + web in parallel
npm run security:scan  # Custom security audit
```

## Environment configuration

Copy `.env.example` to `.env` and fill the required values:

```bash
cp .env.example .env
```

### Required for full functionality

```env
# Autodesk Platform Services
APS_CLIENT_ID="your_client_id"
APS_CLIENT_SECRET="your_client_secret"
APS_CALLBACK_URL="http://localhost:8080/api/auth/callback"

# Cryptographic secrets (32+ random chars each)
SESSION_SECRET="..."
WEBHOOK_SECRET="..."

# Database (auto-configured when running infra via Docker)
DATABASE_URL="postgresql://dom:<password>@localhost:5432/dom_bim"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

`.env.example` documents every variable with its default and purpose.

## Security model

- Rate limiting per IP and per authenticated user, with stricter limits on auth and upload routes
- CORS allowlist driven by environment configuration, no wildcards in production
- Environment validation at boot prevents partial-configuration deploys
- Redis-backed sessions with HttpOnly, Secure, SameSite=Lax cookies
- CSRF protection on state-changing routes
- Helmet.js security headers
- Zod schema validation on every API input
- No hardcoded secrets in the codebase
- Audit log on the database side for sensitive mutations

## Troubleshooting

### Database connection refused

```bash
npm run infra:down
npm run infra:up
npm run db:migrate
```

### Port already in use

Edit `PORT` in `.env` (defaults: API on 8080, frontend on 3000).

### Redis unreachable

```bash
docker ps              # Confirm the redis container is running
npm run infra:up
```

### Full reset

```bash
npm run dev:stop
npm run infra:down
rm -rf node_modules
npm install
npm run dev:infra
npm run db:generate
npm run dev
```

## License

Proprietary. Built for Sebastian Chirino
Copyright (c) 2025–2026 DOM. All rights reserved.
