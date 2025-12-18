# Hito 0: Setup & Verification Guide

## 1. Prerequisites

- **Node.js**: v20 (LTS recommended)
- **Docker**: Desktop running
- **Git**: Installed

## 2. Installation

```bash
# Clone
git clone <repo-url>
cd dom-bim-platform

# Install dependencies (Root, API, Frontend) - Recursive
npm install
```

## 3. Environment Variables

1. Copy example file:

   ```bash
   cp .env.example .env
   ```

2. **Mandatory Configuration**:
   - `SESSION_SECRET`: Must be 32+ chars.
   - `CORS_ORIGINS`: Comma separated URLs (e.g., `http://localhost:3000`).

   - `APS_BUCKET`: Unique bucket name.
   - **APS Requirements**: `APS_CLIENT_ID` and `APS_CLIENT_SECRET` are mandatory. The platform depends on Autodesk services for model visualization.

### 4. Process Management & Workers

The project separates API and Worker responsibilities:

- **API**: Serves HTTP traffic. Does NOT process queues by default (`RUN_WORKERS=false`).
- **Worker**: Processes background jobs. Started via `npm run dev:worker` (Sets `RUN_WORKERS=true`).
  - _Note_: The conversion worker logic is currently a placeholder returning `{ processed: true }`. Real implementation will be added in Hito 1.

In `npm run dev`, both are started in parallel implicitly.

## 5. Development (Run Everything)

One command to rule them all. Starts Infra (Docker), API, Worker, and Frontend.

```bash
npm run dev
```

### Useful Commands

- `npm run dev:infra`: Start only Docker (DB/Redis) via `scripts/infra.js`.
- `npm run dev:worker`: Start dedicated worker process.
- `npm run dev:stop`: Stop all project processes and Docker services.
- `npm run dev:reset`: **Destructive**. Wipes Database & Redis volumes.
- `npm run infra:status`: Check Docker containers and API health.

### 5.1 Cross-Platform Compatibility

All infrastructure commands use `scripts/infra.js` as a unifying wrapper:

- **Windows**: Executes `scripts\infra.bat`.
- **macOS/Linux**: Executes `scripts/infra.sh` (requires Bash).
  - _Recommendation_: Ensure execution permissions: `chmod +x scripts/infra.sh`.

## 6. Verification

Run the health check to verify availability:

```bash
curl http://localhost:8080/health
```

## Troubleshooting

- **Database errors**: Run `npm run db:migrate` manually if auto-migration fails.

## 7. Acceptance Checklist

Run these commands to verify the Gold Master status:

- [ ] **Infrastructure Up**: `npm run dev:infra` -> Docker containers `dom-dev-db` and `dom-dev-redis` running.
- [ ] **Full Stack Up**: `npm run dev` -> API (8080), Worker, and Frontend start without error.
- [ ] **Health Check**: `curl http://localhost:8080/health` -> Returns `200 OK` with DB/Redis status.
- [ ] **Quality Gates**: `npm run lint` and `npm run typecheck` -> Pass with 0 errors.
- [ ] **Clean Stop**: `npm run dev:stop` -> Stops all Node processes and gracefully shuts down Docker containers.
