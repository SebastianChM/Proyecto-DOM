# DOM BIM Platform — Setup Guide

Guide for installing and running the platform locally.

---

## Prerequisites

- **Node.js** 20.x (see `.nvmrc`)
- **npm** >= 9
- **Git**
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)
- **Autodesk Platform Services (APS)** account — [aps.autodesk.com](https://aps.autodesk.com/)
  - You need: Client ID, Client Secret, a Callback URL, and a unique bucket name

---

## Project Structure

This is an npm workspaces monorepo:

```
Proyecto-DOM/
├── apps/
│   ├── api/               # Express + TypeScript backend (port 8080)
│   │   ├── src/
│   │   │   ├── config/    # Env validation, CORS, rate limiting
│   │   │   ├── middleware/ # Auth, RBAC, error handling
│   │   │   ├── routes/    # API routes (aps/, auth/, compliance/, files/, etc.)
│   │   │   ├── services/  # Business logic + APS integrations
│   │   │   └── workers/   # BullMQ workers (conversion, validation, webhooks)
│   │   └── package.json
│   └── web/               # Next.js 16 + React 19 frontend (port 3000)
│       ├── app/           # App Router pages
│       ├── components/    # React components
│       └── package.json
├── packages/
│   └── database/          # Prisma schema + migrations
│       └── prisma/
│           └── schema.prisma
├── infra/
│   └── docker/            # docker-compose.yml (postgres, redis)
├── tools/
│   └── scripts/           # Dev scripts (infra, backup, security scan, etc.)
├── .env.example           # Template — copy to apps/api/.env
└── package.json           # Root: workspaces + orchestration scripts
```

---

## Installation

### 1. Clone and install

```bash
git clone https://github.com/SebastianChM/Proyecto-DOM.git
cd Proyecto-DOM
npm install
```

`npm install` at the root installs all workspaces (`apps/api`, `apps/web`, `packages/database`).

### 2. Start infrastructure (PostgreSQL + Redis)

```bash
npm run dev:infra
```

This runs `docker compose up -d` from `infra/docker/`. Services:

- **PostgreSQL** on port 5432 (user: `dom`, db: `dom_bim`)
- **Redis** on port 6379

Verify they're running:

```bash
npm run infra:status
```

### 3. Configure environment

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` with your values. Key variables:

| Variable            | Required         | Example                                              |
| ------------------- | ---------------- | ---------------------------------------------------- |
| `DATABASE_URL`      | Yes              | `postgresql://dom:yourpass@localhost:5432/dom_bim` |
| `REDIS_HOST`        | Yes              | `localhost`                                          |
| `REDIS_PORT`        | Yes              | `6379`                                               |
| `REDIS_PASSWORD`    | If set in Docker | (empty for default dev)                              |
| `APS_CLIENT_ID`     | Yes              | Your Autodesk app client ID                          |
| `APS_CLIENT_SECRET` | Yes              | Your Autodesk app client secret                      |
| `APS_CALLBACK_URL`  | Yes              | `http://localhost:3000/auth/callback`                |
| `APS_BUCKET`        | Yes              | Globally unique bucket name                          |
| `SESSION_SECRET`    | Yes              | Min 32 random characters                             |
| `WEBHOOK_SECRET`    | Yes              | Min 16 random characters                             |
| `CORS_ORIGINS`      | Yes              | `http://localhost:3000`                              |
| `ADMIN_EMAILS`      | Yes              | `admin@example.com`                                  |

Generate secure secrets:

```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

For development without real Autodesk credentials, set `APS_MOCK=true`.

See `apps/api/src/config/env.ts` for the full schema with defaults and validation.

### 4. Set up the database

```bash
npm run db:generate
npm run db:migrate
```

These run Prisma commands against `packages/database/prisma/schema.prisma`.

---

## Running

### Development (all services)

```bash
npm run dev
```

This starts PostgreSQL/Redis (if not running), then launches concurrently:

- **API** at `http://localhost:8080`
- **Worker** (BullMQ background jobs)
- **Frontend** at `http://localhost:3000`

To stop everything:

```bash
npm run dev:stop
```

### Running individual services

```bash
# API only
npm run dev --prefix apps/api

# Frontend only
npm run dev --prefix apps/web

# Worker only
npm run dev:worker --prefix apps/api
```

---

## Verification

### Health check

```bash
curl -s http://localhost:8080/health | jq .
```

Expected response:

```json
{
  "uptime": 12.5,
  "version": "1.0.0",
  "services": {
    "database": "up",
    "redis": "up"
  },
  "env": "development"
}
```

### Frontend

Open `http://localhost:3000`. Click "Iniciar Sesión" to authenticate via Autodesk OAuth.

### Redis

```bash
redis-cli ping
# Expected: PONG
```

---

## Available Scripts

### Root (run from project root)

| Script                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Start all services (infra + API + worker + frontend) |
| `npm run dev:stop`      | Stop all dev processes                               |
| `npm run dev:reset`     | Reset infrastructure (destroys data)                 |
| `npm run infra:status`  | Check Docker service status                          |
| `npm run infra:up`      | Start Docker services only                           |
| `npm run infra:down`    | Stop Docker services                                 |
| `npm run db:generate`   | Regenerate Prisma client                             |
| `npm run db:migrate`    | Run database migrations                              |
| `npm run db:studio`     | Open Prisma Studio (DB browser)                      |
| `npm run db:backup`     | Backup PostgreSQL to `storage/backups/`              |
| `npm run db:restore`    | Restore PostgreSQL from backup file                  |
| `npm run lint`          | Run ESLint                                           |
| `npm run format`        | Run Prettier                                         |
| `npm run typecheck`     | TypeScript check (API + Web)                         |
| `npm run security:scan` | Scan for hardcoded secrets                           |

### API (`apps/api/`)

| Script          | Description                |
| --------------- | -------------------------- |
| `npm run dev`   | Dev server with hot reload |
| `npm run build` | Compile TypeScript         |
| `npm start`     | Run compiled build         |
| `npm test`      | Run Jest tests             |

### Web (`apps/web/`)

| Script          | Description            |
| --------------- | ---------------------- |
| `npm run dev`   | Next.js dev server     |
| `npm run build` | Production build       |
| `npm start`     | Serve production build |

---

## Troubleshooting

### Port 8080 already in use

```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force

# Linux/macOS
lsof -ti:8080 | xargs kill -9
```

### Prisma Client not initialized

```bash
npm run db:generate
```

### Redis connection refused

```bash
# Check if Docker containers are running
npm run infra:status

# Restart infrastructure
npm run infra:down
npm run infra:up
```

### APS Authentication failed

1. Verify `APS_CLIENT_ID` and `APS_CLIENT_SECRET` in `apps/api/.env`
2. Verify `APS_CALLBACK_URL` matches what you configured in the APS Developer Portal
3. For local dev: `http://localhost:3000/auth/callback`

### CORS errors from frontend

Verify `CORS_ORIGINS` in `apps/api/.env` includes `http://localhost:3000`.

---

## Security Checklist

- [ ] `SESSION_SECRET` is at least 32 random characters
- [ ] `WEBHOOK_SECRET` is at least 16 random characters
- [ ] `.env` files are not committed (covered by `.gitignore`)
- [ ] `CORS_ORIGINS` lists only trusted domains
- [ ] In production: `COOKIE_SECURE=true`, `HSTS_ENABLED=true`, `TRUST_PROXY=true`
- [ ] Redis is not publicly exposed

See `docs/deploy/PRE_DEPLOYMENT_SECURITY.md` for the full production checklist.

---

## Related Documentation

- `docs/deploy/BACKUPS.md` — Database backup and restore procedures
- `docs/deploy/PRE_DEPLOYMENT_SECURITY.md` — Production security checklist
- `docs/ops/STAGING_RUNBOOK.md` — Staging deployment runbook
- `CLAUDE.md` — Architecture overview and known issues
