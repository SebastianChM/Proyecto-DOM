import express from "express";
import request from "supertest";
import { httpLogger } from "../../src/middleware/http-logger";

/**
 * Tests for the HTTP request lifecycle logger middleware.
 *
 * Strategy: capture logger output via console spy, assert level + content.
 * The middleware uses logger.debug/info/warn/error which map to console.*.
 */
describe("httpLogger middleware", () => {
  // Capture console output per level
  let captured: { level: string; msg: string }[];
  const originals = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  function buildApp(status: number, routePath = "/test", originalUrl?: string) {
    const app = express();
    // Simulate x-request-id like the real app does
    app.use((req, _res, next) => {
      req.headers["x-request-id"] = "test-req-id";
      if (originalUrl) {
        // Override originalUrl for sub-router path testing
        Object.defineProperty(req, "originalUrl", { value: originalUrl });
      }
      next();
    });
    app.use(httpLogger);
    app.get(routePath, (_req, res) => {
      res.status(status).json({ ok: true });
    });
    app.post(routePath, (_req, res) => {
      res.status(status).json({ ok: true });
    });
    return app;
  }

  beforeEach(() => {
    captured = [];
    for (const lvl of ["debug", "info", "warn", "error"] as const) {
      (console as unknown as Record<string, unknown>)[lvl] = (msg: string) => {
        captured.push({ level: lvl, msg });
      };
    }
  });

  afterEach(() => {
    console.debug = originals.debug;
    console.info = originals.info;
    console.warn = originals.warn;
    console.error = originals.error;
  });

  // ── Level mapping ─────────────────────────────────────────────

  it("logs 2xx at info level", async () => {
    const app = buildApp(200);
    await request(app).get("/test");
    const httpLog = captured.find((c) => c.msg.includes("GET /test 200"));
    expect(httpLog).toBeDefined();
    expect(httpLog!.level).toBe("info");
  });

  it("logs 4xx at warn level", async () => {
    const app = buildApp(404);
    await request(app).get("/test");
    const httpLog = captured.find((c) => c.msg.includes("GET /test 404"));
    expect(httpLog).toBeDefined();
    expect(httpLog!.level).toBe("warn");
  });

  it("logs 5xx at error level", async () => {
    const app = buildApp(500);
    await request(app).get("/test");
    const httpLog = captured.find((c) => c.msg.includes("GET /test 500"));
    expect(httpLog).toBeDefined();
    expect(httpLog!.level).toBe("error");
  });

  it("logs quiet paths (/health) at debug level for 2xx (suppressed at LOG_LEVEL=info)", async () => {
    const app = buildApp(200, "/health");
    await request(app).get("/health");
    // LOG_LEVEL defaults to "info" in test, so debug is suppressed.
    // Verify that NO info/warn/error log was emitted for this quiet 2xx.
    const httpLog = captured.find(
      (c) => c.msg.includes("/health") && c.msg.includes("200"),
    );
    expect(httpLog).toBeUndefined();
  });

  it("logs quiet paths at warn level for 4xx (overrides quiet)", async () => {
    const app = buildApp(404, "/health");
    await request(app).get("/health");
    const httpLog = captured.find((c) => c.msg.includes("GET /health 404"));
    expect(httpLog).toBeDefined();
    expect(httpLog!.level).toBe("warn");
  });

  // ── Metadata ──────────────────────────────────────────────────

  it("includes requestId in log meta", async () => {
    const app = buildApp(200);
    await request(app).get("/test");
    const httpLog = captured.find((c) => c.msg.includes("GET /test"));
    expect(httpLog!.msg).toContain("test-req-id");
  });

  it("includes duration in log meta", async () => {
    const app = buildApp(200);
    await request(app).get("/test");
    const httpLog = captured.find((c) => c.msg.includes("GET /test"));
    expect(httpLog!.msg).toMatch(/"duration":\d+/);
  });

  it("includes method, path, and status in log message", async () => {
    const app = buildApp(201);
    await request(app).post("/test");
    const httpLog = captured.find((c) => c.msg.includes("POST /test 201"));
    expect(httpLog).toBeDefined();
  });

  // ── Full path (originalUrl) ───────────────────────────────────

  it("uses full originalUrl path, not router-relative path", async () => {
    const app = buildApp(200, "/test", "/api/compliance-v2/test?page=1");
    await request(app).get("/test");
    // Should log the full path from originalUrl minus query
    const httpLog = captured.find((c) =>
      c.msg.includes("/api/compliance-v2/test"),
    );
    expect(httpLog).toBeDefined();
    expect(httpLog!.msg).not.toContain("page=1");
  });

  // ── No body leakage ──────────────────────────────────────────

  it("does not log request or response body", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.headers["x-request-id"] = "body-test";
      next();
    });
    app.use(httpLogger);
    app.post("/test", (_req, res) => {
      res.json({ sensitiveData: "should-not-appear" });
    });

    await request(app)
      .post("/test")
      .send({ password: "hunter2", email: "x@y.com" });

    const allOutput = captured.map((c) => c.msg).join("\n");
    expect(allOutput).not.toContain("hunter2");
    expect(allOutput).not.toContain("should-not-appear");
    expect(allOutput).not.toContain("x@y.com");
  });
});
