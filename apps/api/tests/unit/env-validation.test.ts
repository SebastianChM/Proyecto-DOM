/**
 * Tests for env.ts schema validation and runtime hardening.
 *
 * Covers:
 *   1) Valid env → parse succeeds
 *   2) SMTP partial config → fail-fast with clear message
 *   3) FRONTEND_URL invalid → fail-fast
 *   4) APS_MOCK=true skips APS credentials
 *   5) Startup banner does not expose secrets
 *   6) Pure helper functions (parseAdminEmails, parseCorsOrigins)
 */

import {
  envSchema,
  parseAdminEmails,
  parseCorsOrigins,
} from "../../src/config/env";

// ── Minimal valid env for schema testing ──
// Mirrors what .env + test runner provides. All secrets are placeholders.
function validEnv(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    NODE_ENV: "test",
    PORT: "8080",
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_HOST: "localhost",
    REDIS_PORT: "6379",
    SESSION_SECRET: "a]3Fz!9Qp#mR7&vL$wX2^kT8*nY4gD0H",
    CORS_ORIGINS: "http://localhost:3000",
    APS_CLIENT_ID: "test-client-id",
    APS_CLIENT_SECRET: "test-secret",
    APS_CALLBACK_URL: "http://localhost:8080/api/auth/callback",
    APS_BUCKET: "test-bucket",
    ...overrides,
  };
}

// ── Schema validation tests ──

describe("envSchema", () => {
  it("parses a valid env without errors", () => {
    const result = envSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
  });

  it("rejects partial SMTP configuration (host + user, missing pass)", () => {
    const result = envSchema.safeParse(
      validEnv({ SMTP_HOST: "smtp.example.com", SMTP_USER: "user" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toContain("Partial SMTP configuration");
      expect(messages).toContain("SMTP_PASS");
    }
  });

  it("rejects invalid FRONTEND_URL", () => {
    const result = envSchema.safeParse(validEnv({ FRONTEND_URL: "not-a-url" }));
    expect(result.success).toBe(false);
  });

  it("accepts missing FRONTEND_URL (optional)", () => {
    const env = validEnv();
    delete env.FRONTEND_URL;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it("accepts APS_MOCK=true without APS credentials", () => {
    const result = envSchema.safeParse(
      validEnv({
        APS_MOCK: "true",
        APS_CLIENT_ID: "",
        APS_CLIENT_SECRET: "",
        APS_CALLBACK_URL: "",
        APS_BUCKET: "",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.APS_MOCK).toBe(true);
    }
  });

  it("rejects APS_MOCK=true in production", () => {
    const result = envSchema.safeParse(
      validEnv({ APS_MOCK: "true", NODE_ENV: "production" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toContain("APS_MOCK cannot be enabled in production");
    }
  });

  it("requires APS credentials when APS_MOCK is false", () => {
    const result = envSchema.safeParse(
      validEnv({
        APS_MOCK: "false",
        APS_CLIENT_ID: "",
        APS_CLIENT_SECRET: "",
        APS_CALLBACK_URL: "",
        APS_BUCKET: "",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toContain("APS_CLIENT_ID is required");
    }
  });

  it("rejects SENTRY_DSN with invalid URL", () => {
    const result = envSchema.safeParse(validEnv({ SENTRY_DSN: "not-a-url" }));
    expect(result.success).toBe(false);
  });

  it("accepts valid SENTRY_DSN", () => {
    const result = envSchema.safeParse(
      validEnv({ SENTRY_DSN: "https://key@o0.ingest.sentry.io/0" }),
    );
    expect(result.success).toBe(true);
  });

  it("validates SENTRY_TRACES_SAMPLE_RATE range (0-1)", () => {
    const tooHigh = envSchema.safeParse(
      validEnv({ SENTRY_TRACES_SAMPLE_RATE: "2" }),
    );
    expect(tooHigh.success).toBe(false);

    const valid = envSchema.safeParse(
      validEnv({ SENTRY_TRACES_SAMPLE_RATE: "0.5" }),
    );
    expect(valid.success).toBe(true);
  });

  it("requires Redis (URL or HOST+PORT)", () => {
    const env = validEnv();
    delete env.REDIS_HOST;
    delete env.REDIS_PORT;
    delete env.REDIS_URL;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("accepts REDIS_URL instead of HOST+PORT", () => {
    const env = validEnv({ REDIS_URL: "redis://localhost:6379" });
    delete env.REDIS_HOST;
    delete env.REDIS_PORT;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it("rejects SESSION_SECRET shorter than 32 chars", () => {
    const result = envSchema.safeParse(validEnv({ SESSION_SECRET: "short" }));
    expect(result.success).toBe(false);
  });

  it("accepts full SMTP configuration", () => {
    const result = envSchema.safeParse(
      validEnv({
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "user",
        SMTP_PASS: "pass",
        SMTP_PORT: "587",
      }),
    );
    expect(result.success).toBe(true);
  });
});

// ── Startup banner safety ──

describe("startup banner safety", () => {
  it("banner output does not contain secret values", () => {
    // The banner is emitted via console.log during module load.
    // We verify the banner lines printed during the test suite's env.ts import.
    // Since env.ts is already loaded, we just verify the static format.
    // The banner template uses only safe labels — no DSN, no passwords, no tokens.
    const bannerKeys = [
      "NODE_ENV",
      "APS_MOCK",
      "Redis",
      "SMTP",
      "Frontend URL",
      "Admin emails",
    ];
    const secretPatterns = [
      /APS_CLIENT_SECRET/i,
      /SESSION_SECRET/i,
      /SMTP_PASS/i,
      /REDIS_PASSWORD/i,
      /SENTRY_DSN.*ingest/i, // full DSN should never appear
      /password/i,
      /Bearer /i,
    ];

    // Read the source to verify banner format (static analysis)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    const envSource: string = fs.readFileSync(
      path.join(__dirname, "../../src/config/env.ts"),
      "utf-8",
    );

    // Extract banner section — skip the comment header line
    const bannerStart = envSource.indexOf("// ── Startup banner");
    expect(bannerStart).toBeGreaterThan(-1);
    const bannerLines = envSource.slice(bannerStart).split("\n").slice(1); // skip the comment line itself
    const bannerCode = bannerLines.join("\n");

    // Verify expected safe keys are in banner
    for (const key of bannerKeys) {
      expect(bannerCode).toContain(key);
    }

    // Verify no secret patterns appear in banner log lines
    for (const pattern of secretPatterns) {
      expect(bannerCode).not.toMatch(pattern);
    }
  });
});

// ── Pure function tests ──

describe("parseAdminEmails", () => {
  it("returns empty array for undefined", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseAdminEmails("")).toEqual([]);
  });

  it("parses comma-separated emails, lowercased and trimmed", () => {
    expect(parseAdminEmails(" Alice@DOM.com , bob@test.com ")).toEqual([
      "alice@dom.com",
      "bob@test.com",
    ]);
  });

  it("filters out invalid entries without @", () => {
    expect(parseAdminEmails("good@test.com,notanemail")).toEqual([
      "good@test.com",
    ]);
  });
});

describe("parseCorsOrigins", () => {
  it("parses comma-separated origins", () => {
    expect(parseCorsOrigins("http://a.com, http://b.com")).toEqual([
      "http://a.com",
      "http://b.com",
    ]);
  });

  it("filters empty segments", () => {
    expect(parseCorsOrigins("http://a.com,,")).toEqual(["http://a.com"]);
  });
});
