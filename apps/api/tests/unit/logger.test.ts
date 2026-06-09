import { logger, setTransport, LogLevel } from "../../src/lib/logger";

describe("logger", () => {
  // Capture console output
  const captured: { level: string; msg: string }[] = [];
  const originals = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    captured.length = 0;
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
    // Clear external transport
    setTransport(null as unknown as Parameters<typeof setTransport>[0]);
  });

  // ── Levels ──────────────────────────────────────────────────────

  it("emits info messages to console.info", () => {
    logger.info("test info");
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("info");
    expect(captured[0].msg).toContain("[INFO] test info");
  });

  it("emits warn messages to console.warn", () => {
    logger.warn("test warn");
    expect(captured.some((c) => c.level === "warn")).toBe(true);
  });

  it("emits error messages to console.error", () => {
    logger.error("test error");
    expect(captured.some((c) => c.level === "error")).toBe(true);
  });

  it("includes timestamp in bracket format", () => {
    logger.info("ts test");
    // Format: [2026-03-09T...] [INFO] ts test
    expect(captured[0].msg).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
  });

  // ── Redaction integration ─────────────────────────────────────

  it("redacts sensitive meta before serializing", () => {
    logger.info("auth attempt", { authorization: "Bearer secret123" });
    expect(captured[0].msg).toContain("[REDACTED]");
    expect(captured[0].msg).not.toContain("secret123");
  });

  it("masks email in meta automatically", () => {
    logger.info("user action", { email: "chirinosebastianmn@gmail.com" });
    expect(captured[0].msg).toContain("ch***@gmail.com");
    expect(captured[0].msg).not.toContain("chirinosebastianmn@gmail.com");
  });

  it("truncates userId in meta automatically", () => {
    logger.info("lookup", {
      userId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(captured[0].msg).toContain("550e8400…");
    expect(captured[0].msg).not.toContain("446655440000");
  });

  // ── fromReq ───────────────────────────────────────────────────

  it("fromReq extracts requestId, method, and path from originalUrl", () => {
    const req = {
      headers: { "x-request-id": "req-123" },
      method: "POST",
      path: "/runs",
      originalUrl: "/api/compliance-v2/runs?page=1",
    };
    const ctx = logger.fromReq(req);
    expect(ctx).toEqual({
      requestId: "req-123",
      method: "POST",
      path: "/api/compliance-v2/runs",
    });
  });

  it("fromReq falls back to req.path when originalUrl is absent", () => {
    const req = {
      headers: { "x-request-id": "req-456" },
      method: "GET",
      path: "/health",
    };
    const ctx = logger.fromReq(req);
    expect(ctx.path).toBe("/health");
  });

  // ── setTransport ──────────────────────────────────────────────

  it("setTransport receives ALREADY-REDACTED meta", () => {
    const received: {
      level: LogLevel;
      message: string;
      meta?: Record<string, unknown>;
    }[] = [];
    setTransport((level, message, meta) => {
      received.push({ level, message, meta });
    });

    logger.warn("transport test", {
      token: "supersecret",
      email: "ana@test.com",
    });

    expect(received).toHaveLength(1);
    expect(received[0].level).toBe("warn");
    expect(received[0].message).toBe("transport test");
    // Meta should be redacted
    expect(received[0].meta!.token).toBe("[REDACTED]");
    expect(received[0].meta!.email).toBe("an***@test.com");
  });

  it("does not call transport when level is below threshold", () => {
    // LOG_LEVEL defaults to "info" in test env
    const received: unknown[] = [];
    setTransport(() => {
      received.push(true);
    });
    logger.debug("should be suppressed");
    expect(received).toHaveLength(0);
  });
});
