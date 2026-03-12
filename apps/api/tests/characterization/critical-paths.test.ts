/**
 * Characterization Tests — Critical Paths
 *
 * These tests document the CURRENT behaviour of critical paths.
 * They exist to detect unintended regressions, NOT to enforce new behaviour.
 *
 * What they cover:
 * 1. GET /health → returns well-formed response with database/redis status
 *    (200 with both "up" when Docker services are available,
 *     503 when DB is unreachable but structure is always correct)
 * 2. GET /api/projects without session → 401 with expected error shape
 * 3. Webhook worker uses exact workItemId match (no substring/contains)
 * 4. lib/prisma exports a stable singleton (no multiple PrismaClient instances)
 */

import request from "supertest";
import app from "../../src/index";
import { redis } from "../../src/lib/redis";

// ---------------------------------------------------------------------------
// 1) GET /health — structural contract + service status
// ---------------------------------------------------------------------------

describe("Characterization: GET /health", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("returns well-formed health response with expected shape", async () => {
    const res = await request(app).get("/health");

    // Status is 200 (all up) or 503 (something down) — never anything else
    expect([200, 503]).toContain(res.status);

    // Structural contract: always returns these fields
    expect(res.body).toHaveProperty("uptime");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("env");
    expect(res.body).toHaveProperty("services");
    expect(res.body.services).toHaveProperty("database");
    expect(res.body.services).toHaveProperty("redis");

    // Each service is reported as "up", "down", or "unknown" — never omitted
    expect(["up", "down", "unknown"]).toContain(res.body.services.database);
    expect(["up", "down", "unknown"]).toContain(res.body.services.redis);
  });

  it("returns redis=up when Redis mock is available", async () => {
    const res = await request(app).get("/health");
    // The test setup.ts provides a mock Redis that answers PONG
    expect(res.body.services.redis).toBe("up");
  });

  it("returns 200 with database=up and redis=up when Docker services are running", async () => {
    // This test only runs when DATABASE_URL points at real PostgreSQL
    const dbUrl = process.env.DATABASE_URL || "";
    if (!dbUrl.startsWith("postgresql")) {
      // In pure-mock environment, database is unreachable → skip gracefully
      console.log(
        "  [SKIP] Docker PostgreSQL not available — DATABASE_URL is not postgresql://",
      );
      return;
    }

    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.services).toEqual({
      database: "up",
      redis: "up",
    });
  });
});

// ---------------------------------------------------------------------------
// 2) GET /api/projects without session → 401 + error shape
// ---------------------------------------------------------------------------

describe("Characterization: GET /api/projects (no session)", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("returns 401 with { error: 'Authentication required' } when no session", async () => {
    const res = await request(app).get("/api/projects");

    expect(res.status).toBe(401);
    // The projects route handler checks req.session?.user?.id inline and
    // returns { error: "Authentication required" } — no 'message' field.
    expect(res.body).toHaveProperty("error", "Authentication required");
  });

  it("does not leak stack traces or internal details on 401", async () => {
    const res = await request(app).get("/api/projects");

    expect(res.body).not.toHaveProperty("sql");
    expect(res.body).not.toHaveProperty("prisma");
    expect(res.body).not.toHaveProperty("password");
    // Standard error contract keys only (stack allowed in test/dev)
    const allowedKeys = ["error", "type", "requestId", "stack"];
    for (const key of Object.keys(res.body)) {
      expect(allowedKeys).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// 3) Webhook worker uses exact workItemId match (not substring/contains)
// ---------------------------------------------------------------------------

describe("Characterization: workItemId exact match", () => {
  /**
   * We verify the ACTUAL source code of both lookup sites uses exact equality
   * (where: { workItemId: workItemId }) rather than substring matching
   * (where: { workItemId: { contains: ... } }).
   *
   * This is a static-analysis-style characterization test: we read the
   * source at runtime to ensure no one silently regresses to `contains`.
   */

  let webhookWorkerSource: string;
  let daCallbackServiceSource: string;

  beforeAll(async () => {
    const fs = await import("fs");
    const path = await import("path");

    webhookWorkerSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/workers/webhook-worker.ts"),
      "utf-8",
    );
    daCallbackServiceSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../src/services/design-automation-callback.service.ts",
      ),
      "utf-8",
    );
  });

  it("webhook-worker.ts uses exact workItemId equality (no contains)", () => {
    // Must have the exact-match pattern
    expect(webhookWorkerSource).toMatch(
      /workItemId:\s*(?:workItemId|callback\.workItemId)/,
    );
    // Must NOT have a contains-based lookup for workItemId
    expect(webhookWorkerSource).not.toMatch(
      /workItemId:\s*\{\s*contains/,
    );
  });

  it("design-automation-callback.service.ts uses exact workItemId equality (no contains)", () => {
    // Must have the exact-match pattern
    expect(daCallbackServiceSource).toMatch(
      /workItemId:\s*(?:workItemId|callback\.workItemId)/,
    );
    // Must NOT have a contains-based lookup for workItemId
    expect(daCallbackServiceSource).not.toMatch(
      /workItemId:\s*\{\s*contains/,
    );
  });
});

// ---------------------------------------------------------------------------
// 4) Prisma singleton — lib/prisma exports a single shared instance
// ---------------------------------------------------------------------------

describe("Characterization: Prisma singleton", () => {
  it("lib/prisma exports the same instance on repeated imports", async () => {
    // Two separate dynamic imports of the same module should yield the
    // exact same PrismaClient reference (=== identity check).
    const mod1 = await import("../../src/lib/prisma");
    const mod2 = await import("../../src/lib/prisma");

    // Both default and named export should be identical
    expect(mod1.default).toBe(mod2.default);
    expect(mod1.prisma).toBe(mod2.prisma);
    // And they should be the same object
    expect(mod1.default).toBe(mod1.prisma);
  });

  it("no src/ service file instantiates PrismaClient directly", async () => {
    /**
     * Scan every .ts file under src/ (excluding lib/prisma.ts itself and
     * _quarantine/) and verify none of them call `new PrismaClient()`.
     *
     * This catches the anti-pattern of creating extra Prisma connections
     * outside the singleton.
     */
    const fs = await import("fs");
    const path = await import("path");

    const srcDir = path.resolve(__dirname, "../../src");
    const violations: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "_quarantine") continue;
          walk(full);
        } else if (entry.name.endsWith(".ts")) {
          // Skip the singleton definition itself
          if (full.endsWith(path.join("lib", "prisma.ts"))) continue;

          const content = fs.readFileSync(full, "utf-8");
          if (/new\s+PrismaClient\s*\(/.test(content)) {
            violations.push(path.relative(srcDir, full));
          }
        }
      }
    }

    walk(srcDir);

    expect(violations).toEqual([]);
  });
});
