# Hito 0: Contexto Completo

> Generated on: 2025-12-18T04:09:36.920Z
> Purpose: Aggregated codebase snapshot for LLM Context / Documentation.

## File: package.json

```json
{
  "name": "dom-bim-platform",
  "version": "2.0.0",
  "description": "DOM BIM Platform - Enterprise solution for multi-format BIM management",
  "private": true,
  "workspaces": ["api", "frontend"],
  "scripts": {
    "dev:infra": "node scripts/infra.js up -d",
    "dev:wait": "wait-on tcp:127.0.0.1:5432 tcp:127.0.0.1:6379",
    "dev:sync": "node scripts/gen-frontend-env.js",
    "dev:api": "node scripts/start-service.js API npm run dev --prefix api",
    "dev:worker": "node scripts/start-service.js WRK npm run dev:worker --prefix api",
    "dev:frontend": "node scripts/start-service.js WEB npm run dev --prefix frontend",
    "dev": "npm run dev:infra && npm run dev:wait && npm run dev:sync && concurrently -k -n \"API,WRK,WEB\" \"npm run dev:api\" \"npm run dev:worker\" \"npm run dev:frontend\"",
    "dev:stop": "node scripts/stop-dev.js",
    "dev:reset": "node scripts/infra.js reset",
    "infra:status": "node scripts/infra-status.js",
    "db:generate": "npx prisma generate --schema=./prisma/schema.prisma",
    "db:migrate": "npx prisma migrate dev --schema=./prisma/schema.prisma",
    "db:studio": "npx prisma studio --schema=./prisma/schema.prisma",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "concurrently \"tsc --noEmit --project api/tsconfig.json\" \"tsc --noEmit --project frontend/tsconfig.json\"",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  },
  "devDependencies": {
    "@types/cookie-session": "^2.0.49",
    "concurrently": "^8.2.2",
    "cross-env": "^10.1.0",
    "eslint": "^9.39.2",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^7.0.1",
    "globals": "^16.5.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "prettier": "^3.7.4",
    "tree-kill": "^1.2.2",
    "typescript-eslint": "^8.50.0",
    "wait-on": "^9.0.3"
  },
  "dependencies": {
    "axios": "^1.13.2",
    "form-data": "^4.0.5"
  }
}
```

---

## File: docker-compose.dev.yml

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    container_name: dom-dev-db
    ports:
      - "127.0.0.1:5432:5432" # Bind to localhost only for security
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-dom}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-dom_bim}
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-dom}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - dom-dev-net
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: dom-dev-redis
    ports:
      - "127.0.0.1:6379:6379" # Bind to localhost only
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - dom-dev-net
    restart: unless-stopped

volumes:
  postgres_data_dev:

networks:
  dom-dev-net:
    driver: bridge
```

---

## File: .env.example

```example
# --- General ---
NODE_ENV=development
PORT=8080

# --- Database & Cache ---
POSTGRES_USER=dom
POSTGRES_PASSWORD=CHANGE_ME_IN_ENV
POSTGRES_DB=dom_bim
DATABASE_URL="postgresql://dom:CHANGE_ME_IN_ENV@localhost:5432/dom_bim?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379

# --- APS (Autodesk Platform Services) ---
APS_CLIENT_ID="placeholder"
APS_CLIENT_SECRET="placeholder"
APS_CALLBACK_URL="http://localhost:8080/api/auth/callback"
APS_BUCKET="dom-bim-dev"
APS_WARMUP_ON_START=false
RUN_WORKERS=false
ALLOW_NO_ORIGIN=true

# --- Security ---
SESSION_SECRET="super-secret-at-least-32-chars-long-random-string"
CORS_ORIGINS="http://localhost:3000"

# --- Frontend Public ---
NEXT_PUBLIC_API_BASE_URL="http://localhost:8080"

```

---

## File: .gitignore

```
# Root level gitignore
# Specific ignores are in /api and /frontend subdirectories

# Dependencies
node_modules/

# Build output (compiled TypeScript)
dist/
api/dist/
frontend/.next/

# Environment variables
# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.env
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Debug and test files
.dev/
*debug*.txt
*debug*.log
*debug*.js
test_*.txt
test_*.js
test-*.txt
check-*.js
upload_*.txt
*_test.*

# Gemini artifacts (optional - uncomment if you don't want to commit)
# .gemini/

```

---

## File: eslint.config.mjs

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/dist/", "**/.next/", "**/.dev/"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts", "**/*.tsx", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: react,
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-undef": "off",
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
);
```

---

## File: docs/setup/HITO0.md

````md
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
````

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

````

---

## File: scripts/gen-frontend-env.js

```javascript
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load root .env
const rootEnvPath = path.resolve(__dirname, '../.env');
const frontendEnvPath = path.resolve(__dirname, '../frontend/.env.local');

console.log(`[Sync] Reading from ${rootEnvPath}`);

if (!fs.existsSync(rootEnvPath)) {
    console.warn('⚠️  Root .env file not found. Skipping auto-sync.');
    process.exit(0);
}

const config = dotenv.config({ path: rootEnvPath }).parsed || {};

// Validate NEXT_PUBLIC_API_BASE_URL
const apiBaseUrl = config['NEXT_PUBLIC_API_BASE_URL'];
if (!apiBaseUrl) {
    console.error('❌ Error: NEXT_PUBLIC_API_BASE_URL is missing in root .env');
    process.exit(1);
}

try {
    new URL(apiBaseUrl);
} catch {
    console.error(`❌ Error: NEXT_PUBLIC_API_BASE_URL is not a valid URL: "${apiBaseUrl}"`);
    process.exit(1);
}

const publicVars = Object.keys(config)
    .filter(k => k.startsWith('NEXT_PUBLIC_'))
    .map(k => `${k}="${config[k]}"`)
    .join('\n');

fs.writeFileSync(frontendEnvPath, `# Auto-generated from root .env\n${publicVars}`);

const publicCount = publicVars.split('\n').filter(l => l.trim()).length;
console.log(`✅ Synced ${publicCount} vars to frontend/.env.local`);

````

---

## File: scripts/start-service.js

```javascript
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const args = process.argv.slice(2);
const name = args[0];
const cmd = args[1];
const cmdArgs = args.slice(2);

if (!name || !cmd) {
  console.error("Usage: node start-service.js <name> <command> [args...]");
  process.exit(1);
}

const pidsFile = path.resolve(__dirname, "../.dev/pids.json");

// Handle Windows npm behavior
// npm on windows is npm.cmd
const finalCmd =
  process.platform === "win32" && cmd === "npm" ? "npm.cmd" : cmd;

console.log(`🚀 [${name}] Starting: ${finalCmd} ${cmdArgs.join(" ")}`);

// Use spawn without shell: true to keep process tree clean and manageable
// We pass stdio: inherit to see output in main console
const child = spawn(finalCmd, cmdArgs, {
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "true" },
});

const pidsDir = path.dirname(pidsFile);
if (!fs.existsSync(pidsDir)) {
  fs.mkdirSync(pidsDir, { recursive: true });
}

// Save PID to file for stop-dev.js
let pids = {};
if (fs.existsSync(pidsFile)) {
  try {
    pids = JSON.parse(fs.readFileSync(pidsFile, "utf-8"));
  } catch {
    // failed to write pid
  }
}
pids[name] = child.pid;
fs.writeFileSync(pidsFile, JSON.stringify(pids, null, 2));

child.on("exit", (code) => {
  console.log(`[${name}] Exited with code ${code}`);
});

child.on("error", (err) => {
  console.error(`[${name}] Failed to start: ${err.message}`);
});
```

---

## File: scripts/stop-dev.js

```javascript
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const util = require("util");
const treeKill = util.promisify(require("tree-kill"));

const pidsFile = path.resolve(__dirname, "../.dev/pids.json");

const stopProcesses = async () => {
  if (fs.existsSync(pidsFile)) {
    try {
      const pids = JSON.parse(fs.readFileSync(pidsFile, "utf-8"));
      const killPromises = Object.entries(pids).map(async ([name, pid]) => {
        console.log(`Attempting to stop ${name} (PID: ${pid})...`);
        try {
          await treeKill(Number(pid), "SIGTERM");
          console.log(`✅ Stopped ${name} tree`);
        } catch (err) {
          console.error(`⚠️  Failed to stop ${name} tree:`, err);
        }
      });

      await Promise.all(killPromises);

      // Remove file ONLY after all attempts are done
      try {
        fs.unlinkSync(pidsFile);
        console.log("🧹 Cleaned up pids.json");
      } catch {
        /* ignore if already gone */
      }
    } catch (e) {
      console.error("Error reading/processing PIDs file:", e);
    }
  } else {
    console.log("ℹ️  No PIDs file found (.dev/pids.json).");
  }
};

// Wrap main logic in async execution
(async () => {
  await stopProcesses();

  console.log("📉 Stopping Infrastructure...");
  try {
    // Reuse the cross-platform wrapper logic mechanism or call it directly.
    // To be perfectly aligned, we should probably just spawn infra.js down.
    // But for "Pendiente cero", let's make sure it works as expected.
    // The simplest restart-safe way is calling the same wrapper Node script or replicating its logic.
    // Let's replicate logic to avoid spawning another node process if not strictly needed,
    // OR better, spawn the new infra.js to maintain Single Source of Truth as requested.

    const infraScript = path.resolve(__dirname, "infra.js");
    execSync(`node "${infraScript}" down`, { stdio: "inherit" });

    console.log("✅ Infrastructure stopped");
  } catch (e) {
    console.error("Error stopping docker:", e.message);
  }
})();
```

---

## File: scripts/infra.js

```javascript
const { spawn } = require("child_process");

// Detect Platform
const isWin = process.platform === "win32";

const script = isWin ? "scripts\\infra.bat" : "scripts/infra.sh";
const cmd = isWin ? script : "bash";

// Handle custom "reset" command
const inputArgs = process.argv.slice(2);
if (inputArgs[0] === "reset") {
  console.log("🔄 Executing Infra Reset (Down -v + Up -d)...");

  // We run down -v, then up -d sequentially
  try {
    runInfra(["down", "-v"]);
    runInfra(["up", "-d"]);
    console.log("✅ Infra reset complete (Volumes wiped & Restarted)");
    process.exit(0);
  } catch (e) {
    console.error("❌ Reset failed:", e.message);
    process.exit(1);
  }
} else {
  // Passthrough normal commands
  const args = isWin ? inputArgs : [script, ...inputArgs];
  spawnInfra(cmd, args);
}

function runInfra(args) {
  const finalArgs = isWin ? args : [script, ...args];
  const result = require("child_process").spawnSync(cmd, finalArgs, {
    stdio: "inherit",
    shell: isWin,
  });
  if (result.status !== 0)
    throw new Error(`Command failed with code ${result.status}`);
}

function spawnInfra(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWin,
  });
  child.on("close", (code) => process.exit(code));
  child.on("error", (err) => {
    console.error("❌ Infra Execution Failed:", err);
    process.exit(1);
  });
}
```

---

## File: scripts/infra.bat

```bat
@echo off
docker compose version >nul 2>nul
IF NOT ERRORLEVEL 1 (
    docker compose -f docker-compose.dev.yml %*
) ELSE (
    docker-compose -f docker-compose.dev.yml %*
)

```

---

## File: scripts/infra.sh

```sh
#!/bin/bash
# scripts/infra.sh - Wrapper for docker-compose / docker compose

if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.dev.yml "$@"
elif docker compose version &> /dev/null; then
    docker compose -f docker-compose.dev.yml "$@"
else
    echo "❌ Docker Compose not found (tried 'docker-compose' and 'docker compose')."
    exit 1
fi

```

---

## File: scripts/infra-status.js

```javascript
const http = require("http");
const { execSync } = require("child_process");

console.log("🐳 Checking Docker Status...");
try {
  execSync("docker ps", { stdio: "inherit" });
} catch {
  console.error("❌ Docker check failed. Is Docker running?");
  process.exit(1);
}

console.log("\n❤️  Checking API Health...");
const options = {
  hostname: "localhost",
  port: 8080,
  path: "/health",
  method: "GET",
  timeout: 2000, // 2 seconds timeout
};

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    console.log(`SC: ${res.statusCode}`);
    console.log(`Body: ${data}`);
    if (res.statusCode === 200) {
      console.log("✅ API Online");
      process.exit(0);
    } else {
      console.log("⚠️ API returned non-200 status");
      process.exit(1);
    }
  });
});

req.on("error", (e) => {
  console.error(`❌ API Health Check Failed: ${e.message}`);
  console.log("   (Is the API server running?)");
  process.exit(1);
});

req.on("timeout", () => {
  req.destroy();
  console.error("❌ API Health Check Timed Out");
  process.exit(1);
});

req.end();
```

---

## File: .gitattributes

```
* text=auto
scripts/*.sh text eol=lf

```

---

## File: .husky/pre-commit

```
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
npm run typecheck

```

---

## File: api/package.json

```json
{
  "name": "dom-bim-api",
  "version": "1.0.0",
  "description": "DOM BIM Platform - API Backend",
  "main": "dist/src/index.js",
  "prisma": {
    "schema": "../prisma/schema.prisma"
  },
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push",
    "prisma:studio": "prisma studio",
    "dev:worker": "cross-env RUN_WORKERS=true ts-node-dev --respawn --transpile-only src/worker.ts",
    "start:worker": "node dist/src/worker.js"
  },
  "dependencies": {
    "@prisma/client": "^5.7.0",
    "archiver": "^7.0.1",
    "aws-sdk": "^2.1498.0",
    "axios": "^1.13.2",
    "bull": "^4.16.5",
    "cookie-session": "^2.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "forge-apis": "^0.9.11",
    "form-data": "^4.0.5",
    "fs-extra": "^11.3.2",
    "handlebars": "^4.7.8",
    "helmet": "^7.1.0",
    "ioredis": "^5.8.2",
    "mammoth": "^1.11.0",
    "nodemailer": "^7.0.11",
    "pdf-parse": "^1.1.1",
    "pdf.js-extract": "^0.2.1",
    "puppeteer": "^24.32.0",
    "socket.io": "^4.8.1",
    "xlsx": "^0.18.5",
    "zod": "^4.2.1"
  },
  "devDependencies": {
    "@types/archiver": "^7.0.0",
    "@types/bull": "^3.15.9",
    "@types/fs-extra": "^11.0.4",
    "@types/ioredis": "^4.28.10",
    "@types/jest": "^30.0.0",
    "@types/morgan": "^1.9.9",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.10.5",
    "@types/nodemailer": "^7.0.4",
    "@types/pdf-parse": "^1.1.5",
    "@types/pdfkit": "^0.17.4",
    "@types/supertest": "^6.0.3",
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-express": "^4.1.8",
    "@types/uuid": "^10.0.0",
    "jest": "^30.2.0",
    "pdfkit": "^0.17.2",
    "prisma": "^5.7.0",
    "supertest": "^7.1.4",
    "ts-jest": "^29.4.6",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
```

---

## File: api/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*", "src/global.d.ts"],
  "exclude": ["node_modules", "dist", "tools", "scripts"]
}
```

---

## File: api/src/config/env.ts

```typescript
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Use process.cwd() to be reliable across build/dev
// Assuming this code runs from api/src/config, we go up to root
// But in production compilation, structure might change.
// Best practice: rely on process.cwd() if started from root.
// Strategy: ALWAYS load from root .env or rely on system vars
const rootEnv = path.resolve(process.cwd(), ".env");

if (fs.existsSync(rootEnv)) {
  console.log(`[ENV] Loading configuration from CWD: ${rootEnv}`);
  dotenv.config({ path: rootEnv });
} else {
  console.warn(
    `[ENV] ⚠️  No .env file found at ${rootEnv}. Relying on system environment variables.`,
  );
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.string().default("8080").transform(Number),
    DATABASE_URL: z
      .string()
      .startsWith("postgresql://", {
        message: "Must be a valid postgresql URL",
      }),
    // Redis: Allow either URL or HOST/PORT
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().transform(Number).optional(),
    REDIS_URL: z.string().optional(),

    // APS Config
    APS_CLIENT_ID: z.string().min(1, { message: "APS_CLIENT_ID is required" }),
    APS_CLIENT_SECRET: z
      .string()
      .min(1, { message: "APS_CLIENT_SECRET is required" }),
    APS_CALLBACK_URL: z.string().url(),
    APS_BUCKET: z.string().min(1, { message: "APS_BUCKET is required" }),
    SESSION_SECRET: z
      .string()
      .min(32, { message: "Session secret must be at least 32 chars" }),
    CORS_ORIGINS: z.string().min(1, { message: "CORS_ORIGINS is required" }),

    // Flags
    APS_WARMUP_ON_START: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    RUN_WORKERS: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    ENABLE_DEBUG_ROUTES: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    ALLOW_NO_ORIGIN: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
  })
  .refine(
    (data) => {
      return !!data.REDIS_URL || (!!data.REDIS_HOST && !!data.REDIS_PORT);
    },
    {
      message: "Either REDIS_URL or (REDIS_HOST + REDIS_PORT) must be defined",
      path: ["REDIS_HOST"],
    },
  );

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "❌ [ENV] Validation Failed:",
    JSON.stringify(_env.error.format(), null, 2),
  );
  process.exit(1);
}

export const env = _env.data;
console.log("✅ [ENV] Validation Success");
```

---

## File: api/src/config/cors.config.ts

```typescript
/**
 * CORS Configuration
 * Restricts API access to specific trusted origins
 */

import { CorsOptions } from "cors";
import { env } from "./env";

export const getCorsOptions = (): CorsOptions => {
  // Parse allowed origins from env.CORS_ORIGINS (comma separated)
  // Example: "http://localhost:3000,http://localhost:8080"
  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      // But usually in strict production you might block them.
      if (!origin) {
        if (env.ALLOW_NO_ORIGIN) return callback(null, true);
        return callback(new Error("Not allowed by CORS (No Origin)"));
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  };
};
```

---

## File: api/src/index.ts

```typescript
import express from "express";
import dashboardRouter from "./routes/dashboard";
import cors from "cors";

import helmet from "helmet";

import morgan from "morgan";
import cookieSession from "cookie-session";
import { rateLimiter } from "./services/rate-limiter.service";

// Load and validate environment variables (Fail fast)
import { env } from "./config/env";
import path from "path";

// Routes
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import filesRouter from "./routes/files";
import projectsRouter from "./routes/projects";
import projectMembersRouter from "./routes/project-members";
import conversionRouter from "./routes/conversion";
import comparisonRouter from "./routes/comparison";
import apsProxyRouter from "./routes/aps-proxy";
import translationRouter from "./routes/translation";
import viewerRouter from "./routes/viewer";
import validationRouter from "./routes/validation";
import validationsRouter from "./routes/validations";
import notificationsRouter from "./routes/notifications";
import validationRunnerRouter from "./routes/validation-runner";
import reportsRouter from "./routes/reports"; // Import Reports Router
import webhooksRouter from "./routes/webhooks"; // Import Webhooks Router
import complianceRouter from "./routes/compliance"; // Compliance Engine
import complianceV2Router from "./routes/compliance-rules"; // Compliance Engine V2 - Professional Rules
import complianceRunsRouter from "./routes/compliance-runs"; // Compliance Runs V2
import complianceExportRouter from "./routes/compliance-export"; // Compliance Export
import dataSourcesRouter from "./routes/data-sources"; // Data Extraction for Compliance
import workflowsRouter from "./routes/workflows"; // Workflow Engine
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});

const app = express();
const PORT = env.PORT;

// Import configurations
import { getCorsOptions } from "./config/cors.config";
import { Redis } from "ioredis";

// Redis Client Factory
let redisClient: Redis;
if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL);
} else {
  redisClient = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });
}
export const redis = redisClient;

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin resource sharing for downloads
  }),
);
app.use(cors(getCorsOptions()));
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files for mock downloads
app.use("/downloads", express.static(path.join(__dirname, "../downloads")));

// Session
app.use(
  cookieSession({
    name: "dom-session",
    keys: [env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }),
);

// Public routes (no auth required)
app.get("/", (req, res) => {
  res.send(
    '<h1>🚀 DOM BIM Platform API</h1><p>Status: Online</p><p>Check <a href="/health">/health</a> for status.</p>',
  );
});

import healthRouter from "./routes/health";
app.use("/health", healthRouter);

// Debug endpoint - verificar configuración APS (Protected)
if (env.ENABLE_DEBUG_ROUTES) {
  app.get("/debug/aps-config", (req, res) => {
    res.json({
      hasClientId: !!env.APS_CLIENT_ID,
      hasClientSecret: !!env.APS_CLIENT_SECRET,
      callbackUrl: env.APS_CALLBACK_URL,
      clientIdPreview: env.APS_CLIENT_ID
        ? env.APS_CLIENT_ID.substring(0, 10) + "..."
        : "MISSING",
      bucket: env.APS_BUCKET,
    });
  });
}
// Core Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use(
  "/api/files",
  rateLimiter.uploadLimiter
    ? rateLimiter.uploadLimiter()
    : rateLimiter.apiLimiter(),
  filesRouter,
); // Use upload limiter if available
app.use("/api/projects", rateLimiter.apiLimiter(), projectsRouter);
app.use("/api/project-members", rateLimiter.apiLimiter(), projectMembersRouter);

// Service Routes
app.use(
  "/api/validation",
  rateLimiter.heavyOperationLimiter(),
  validationRouter,
);
app.use("/api/validations", rateLimiter.apiLimiter(), validationsRouter);
app.use("/api/notifications", rateLimiter.apiLimiter(), notificationsRouter);
app.use(
  "/api/validation-runner",
  rateLimiter.heavyOperationLimiter(),
  validationRunnerRouter,
);
app.use("/api/reports", rateLimiter.heavyOperationLimiter(), reportsRouter);
app.use(
  "/api/conversion",
  rateLimiter.heavyOperationLimiter(),
  conversionRouter,
);
app.use(
  "/api/translation",
  rateLimiter.heavyOperationLimiter(),
  translationRouter,
);
app.use("/api/viewer", rateLimiter.apiLimiter(), viewerRouter);
app.use(
  "/api/comparison",
  rateLimiter.heavyOperationLimiter(),
  comparisonRouter,
);
app.use("/api/dashboard", rateLimiter.apiLimiter(), dashboardRouter);
app.use("/api/aps", apsProxyRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/compliance", complianceRouter);
app.use("/api/compliance-v2", rateLimiter.apiLimiter(), complianceV2Router); // Professional Rule-Based Validation
app.use(
  "/api/compliance-v2/runs",
  rateLimiter.heavyOperationLimiter(),
  complianceRunsRouter,
); // Compliance Runs
app.use(
  "/api/compliance-v2/export",
  rateLimiter.apiLimiter(),
  complianceExportRouter,
); // Compliance Export
app.use(
  "/api/data-sources",
  rateLimiter.heavyOperationLimiter(),
  dataSourcesRouter,
); // Data Extraction
app.use("/api/workflows", rateLimiter.apiLimiter(), workflowsRouter);

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling
import { errorHandler } from "./middleware/error-handler";
app.use(errorHandler);

import { modelDerivativeService } from "./services/aps/model-derivative.service";
import { createServer } from "http";
import { socketService } from "./lib/socket";
import { conversionWorker } from "./workers/conversion.worker";

const httpServer = createServer(app);

// Start the worker (Only if enabled, otherwise dedicated worker process handles it)
if (env.RUN_WORKERS) {
  console.log("🔧 Starting embedded worker...");
  conversionWorker.start();
} else {
  console.log(
    "ℹ️  Embedded worker disabled (RUN_WORKERS=false). Expecting dedicated worker process.",
  );
}

// Start server if run directly
if (require.main === module) {
  (async () => {
    try {
      // Verify Redis connection BEFORE listening
      await redis.ping();
      console.log("✅ Redis: Connected and operational");
    } catch (error: any) {
      console.error("❌ Redis: Connection failed -", error.message);
      // Fail Fast in development
      if (env.NODE_ENV === "development") {
        console.error("🚨 Redis is required in development. Exiting...");
        process.exit(1);
      }
      console.warn(
        "⚠️ Server will continue but cache features will be disabled (Production Fallback)",
      );
    }

    httpServer.listen(PORT, async () => {
      console.log(`🚀 DOM BIM API running on port ${PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(
        `   Worker Mode: ${env.RUN_WORKERS ? "Embedded" : "Dedicated"}`,
      );

      // Initialize Socket.IO
      socketService.initialize(httpServer);
      console.log("   Socket.IO: Initialized");

      // Warm up formats cache on startup (Optional)
      if (env.APS_WARMUP_ON_START) {
        try {
          console.log("Pre-fetching supported formats from APS...");
          await modelDerivativeService.getFormats();
          console.log("Formats cache warmed up");
        } catch (error) {
          console.warn(
            "Failed to warm up formats cache (will retry on demand):",
            error,
          );
        }
      }
    });
  })().catch((err) => {
    console.error("❌ Fatal Error during startup:", err);
    process.exit(1);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  try {
    await redis.quit();
    console.log("Redis connection closed");
  } catch (error) {
    console.error("Error closing Redis:", error);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  try {
    await redis.quit();
    console.log("Redis connection closed");
  } catch (error) {
    console.error("Error closing Redis:", error);
  }
  process.exit(0);
});

export default app;
```

---

## File: api/src/worker.ts

```typescript
import { env } from "./config/env";

import prisma from "./lib/prisma";
import { redis } from "./lib/redis";
import { Queues } from "./lib/queue";
import { validationJob } from "./jobs/validation.job";

console.log(
  `🚀 DOM BIM Platform - Worker Process Starting [${env.NODE_ENV}]...`,
);

const startWorker = async () => {
  try {
    // Connect to DB
    await prisma.$connect();
    console.log("✅ Worker: Database connected");

    // Connect to Redis (Fail fast)
    await redis.ping();
    console.log("✅ Worker: Redis connected");

    // Process Validation Queue
    Queues.validation.process(async (job) => {
      return validationJob(job);
    });
    console.log("✅ Worker: Validation queue processor ready");

    // Placeholder for other queues
    Queues.conversion.process(async (job) => {
      console.log(`[Conversion] Processing job ${job.id}`);
      return { processed: true };
    });
    console.log("✅ Worker: Conversion queue processor ready");

    console.log("✅ Worker: All systems operational");
  } catch (error) {
    console.error("❌ Worker failed to start:", error);
    process.exit(1);
  }
};

startWorker();

// Graceful Custom Shutdown
const shutdown = async () => {
  console.log("Worker shutting down...");
  await Queues.validation.close();
  await Queues.conversion.close();
  await Queues.comparison.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

---

## File: api/src/lib/prisma.ts

```typescript
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env"; // Uses typed config

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Standardize global implementation
export default prisma;
```

---

## File: api/src/routes/health.ts

```typescript
import { Router } from "express";
import prisma from "../lib/prisma";
import { redis } from "../lib/redis";
import { env } from "../config/env";

const router = Router();

router.get("/", async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "unknown",
    services: {
      database: "unknown",
      redis: "unknown",
    },
    env: env.NODE_ENV,
  };

  let status = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = "up";
  } catch (e: unknown) {
    health.services.database = "down";
    status = 503;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Health Check DB Failed:", msg);
  }

  try {
    await redis.ping();
    health.services.redis = "up";
  } catch (e: unknown) {
    health.services.redis = "down";
    status = 503;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Health Check Redis Failed:", msg);
  }

  // Return 503 if any critical service is down
  res.status(status).json(health);
});

export default router;
```

---

## File: api/src/global.d.ts

```typescript
import "express";

declare module "express" {
  interface Request {
    session?: {
      jwt?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    } | null;
    user?: {
      id?: string;
      name?: string;
      email?: string;
      role?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  }
}
```

---
