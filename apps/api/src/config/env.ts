import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env from project root
const rootEnv = path.resolve(process.cwd(), ".env");

if (fs.existsSync(rootEnv)) {
  console.log(`[ENV] Loading configuration from CWD: ${rootEnv}`);
  dotenv.config({ path: rootEnv });
} else {
  console.warn(
    `[ENV] ⚠️  No .env file found at ${rootEnv}. Relying on system environment variables.`,
  );
}

/**
 * Parse and normalize ADMIN_EMAILS from comma-separated string
 * Pure function for testability
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}

/**
 * Parse CORS_ORIGINS from comma-separated string
 * Pure function for testability
 */
export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/** @internal Exported for test use — do not import in production code */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.string().default("8080").transform(Number),
    DATABASE_URL: z.string(),

    // Redis: Allow either URL or HOST/PORT
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().transform(Number).optional(),
    REDIS_URL: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),

    // APS Mock Mode (development/test only — bypasses real Autodesk calls)
    APS_MOCK: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),

    // APS Config (conditionally required — see superRefine below)
    APS_CLIENT_ID: z.string().optional().default(""),
    APS_CLIENT_SECRET: z.string().optional().default(""),
    APS_CALLBACK_URL: z.string().optional().default(""),
    APS_BUCKET: z.string().optional().default(""),

    // Session & Security
    SESSION_SECRET: z
      .string()
      .min(32, { message: "Session secret must be at least 32 chars" }),
    CORS_ORIGINS: z.string().min(1, { message: "CORS_ORIGINS is required" }),
    ADMIN_EMAILS: z.string().optional().default(""),
    WEBHOOK_SECRET: z.string().optional().default(""),

    // APS Webhooks
    APS_WEBHOOK_SIGNING_SECRET: z.string().optional().default(""),
    APS_WEBHOOK_URL: z.string().optional().default(""),

    // Queue & Worker
    WEBHOOK_QUEUE_CONCURRENCY: z.string().default("5").transform(Number),
    POLLING_INTERVAL_MINUTES: z.string().default("30").transform(Number),

    // Logging
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    // Proxy & HTTPS
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("lax"),
    HSTS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),

    // Rate Limiting
    RATE_LIMIT_STORE: z.enum(["redis", "memory"]).default("redis"),

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
    DEV_ALLOW_NGROK: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    SKIP_WEBHOOK_VALIDATION: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),

    // SMTP (optional — all-or-none validated in superRefine)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().min(1).max(65535).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),
    SMTP_FROM: z.string().optional(),

    // Frontend URL (used for OAuth redirects)
    FRONTEND_URL: z.string().url().optional(),

    // Design Automation
    APS_DA_NICKNAME: z.string().optional(),

    // Upload & Demo
    MAX_FILE_SIZE_BYTES: z.coerce.number().min(1).optional(),
    DEMO_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((val) => val === "true"),

    // External Transport (optional — Sentry error tracking)
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    // Conversion Concurrency Limits (Hito 5)
    CONVERSION_CONCURRENCY: z.coerce.number().min(1).max(20).default(10),
    CONVERSION_MD_CONCURRENCY: z.coerce.number().min(1).max(15).default(8),
    CONVERSION_DA_CONCURRENCY: z.coerce.number().min(1).max(10).default(5),
    CONVERSION_MAX_ATTEMPTS: z.coerce.number().default(3),
    CONVERSION_BACKOFF_DELAY: z.coerce.number().default(2000),
    DEFAULT_LOCALE: z.string().default("es-CL"),
    // LLM-Assisted Requirement Extraction (FASE 7)
    OPENAI_API_KEY: z.string().optional(),
    ALLOW_EMPTY_ADMIN_EMAILS: z
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
  )
  .superRefine((data, ctx) => {
    // APS_MOCK is forbidden in production
    if (data.APS_MOCK && data.NODE_ENV === "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "APS_MOCK cannot be enabled in production",
        path: ["APS_MOCK"],
      });
      return;
    }

    // When APS_MOCK=true, skip credential validation
    if (data.APS_MOCK) return;

    if (!data.APS_CLIENT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "APS_CLIENT_ID is required when APS_MOCK is not enabled",
        path: ["APS_CLIENT_ID"],
      });
    }
    if (!data.APS_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "APS_CLIENT_SECRET is required when APS_MOCK is not enabled",
        path: ["APS_CLIENT_SECRET"],
      });
    }
    if (!data.APS_CALLBACK_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "APS_CALLBACK_URL is required when APS_MOCK is not enabled",
        path: ["APS_CALLBACK_URL"],
      });
    } else {
      try {
        new URL(data.APS_CALLBACK_URL);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "APS_CALLBACK_URL must be a valid URL when APS_MOCK is not enabled",
          path: ["APS_CALLBACK_URL"],
        });
      }
    }
    if (!data.APS_BUCKET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "APS_BUCKET is required when APS_MOCK is not enabled",
        path: ["APS_BUCKET"],
      });
    }

    // SMTP all-or-none: if any SMTP var is set, all required ones must be present
    const smtpVars = [data.SMTP_HOST, data.SMTP_USER, data.SMTP_PASS];
    const smtpProvided = smtpVars.filter(Boolean).length;
    if (smtpProvided > 0 && smtpProvided < smtpVars.length) {
      const missing = [];
      if (!data.SMTP_HOST) missing.push("SMTP_HOST");
      if (!data.SMTP_USER) missing.push("SMTP_USER");
      if (!data.SMTP_PASS) missing.push("SMTP_PASS");
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Partial SMTP configuration detected. Missing: ${missing.join(", ")}. Provide all SMTP vars or none.`,
        path: ["SMTP_HOST"],
      });
    }
  });

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "❌ [ENV] Validation Failed:",
    JSON.stringify(_env.error.format(), null, 2),
  );
  process.exit(1);
}

// Additional production validations
const parsedEnv = _env.data;

// Validate ADMIN_EMAILS in production
const adminEmailsList = parseAdminEmails(parsedEnv.ADMIN_EMAILS);
if (parsedEnv.NODE_ENV === "production" && adminEmailsList.length === 0) {
  if (!parsedEnv.ALLOW_EMPTY_ADMIN_EMAILS) {
    console.error(
      "❌ [ENV] ADMIN_EMAILS is empty in production. Set ALLOW_EMPTY_ADMIN_EMAILS=true to override.",
    );
    process.exit(1);
  }
  console.warn(
    "⚠️ [ENV] ADMIN_EMAILS is empty in production (override enabled)",
  );
}

// Validate CORS_ORIGINS doesn't contain wildcard
const corsOriginsList = parseCorsOrigins(parsedEnv.CORS_ORIGINS);
if (corsOriginsList.includes("*")) {
  console.error(
    "❌ [ENV] CORS_ORIGINS contains wildcard (*). This is prohibited for security.",
  );
  process.exit(1);
}

// Validate WEBHOOK_SECRET in production
if (
  parsedEnv.NODE_ENV === "production" &&
  (!parsedEnv.WEBHOOK_SECRET || parsedEnv.WEBHOOK_SECRET.length < 16)
) {
  console.error(
    "❌ [ENV] WEBHOOK_SECRET must be at least 16 characters in production",
  );
  process.exit(1);
}

// Derived: SMTP configured flag (all-or-none already validated above)
const smtpConfigured = !!(
  parsedEnv.SMTP_HOST &&
  parsedEnv.SMTP_USER &&
  parsedEnv.SMTP_PASS
);

// Derived: Redis connection mode
const redisMode = parsedEnv.REDIS_URL ? "URL" : `HOST+PORT`;

// Derived: Frontend URL (validated if explicit, otherwise default)
const frontendUrl = parsedEnv.FRONTEND_URL || "http://localhost:3000";

// Export parsed values with pre-computed lists
export const env = {
  ...parsedEnv,
  adminEmails: adminEmailsList,
  corsOrigins: corsOriginsList,

  // APS Mock Mode
  APS_MOCK: parsedEnv.APS_MOCK,

  // Webhook Config
  APS_WEBHOOK_SIGNING_SECRET: parsedEnv.APS_WEBHOOK_SIGNING_SECRET || "",
  APS_WEBHOOK_URL: parsedEnv.APS_WEBHOOK_URL || "",
  WEBHOOK_QUEUE_CONCURRENCY: parsedEnv.WEBHOOK_QUEUE_CONCURRENCY,
  POLLING_INTERVAL_MINUTES: parsedEnv.POLLING_INTERVAL_MINUTES,
  LOG_LEVEL: parsedEnv.LOG_LEVEL,
  SKIP_WEBHOOK_VALIDATION: parsedEnv.SKIP_WEBHOOK_VALIDATION,

  // SMTP (validated all-or-none)
  smtpConfigured,
  SMTP_FROM: parsedEnv.SMTP_FROM || '"BIM Platform" <noreply@example.com>',

  // Frontend
  FRONTEND_URL: frontendUrl,

  // Design Automation
  APS_DA_NICKNAME: parsedEnv.APS_DA_NICKNAME || parsedEnv.APS_CLIENT_ID || "",

  // Upload & Demo
  MAX_FILE_SIZE_BYTES: parsedEnv.MAX_FILE_SIZE_BYTES || 209715200, // 200MB default
  DEMO_MODE: parsedEnv.DEMO_MODE,

  // Conversion Concurrency (Hito 5)
  CONVERSION_CONCURRENCY: parsedEnv.CONVERSION_CONCURRENCY,
  CONVERSION_MD_CONCURRENCY: parsedEnv.CONVERSION_MD_CONCURRENCY,
  CONVERSION_DA_CONCURRENCY: parsedEnv.CONVERSION_DA_CONCURRENCY,
  CONVERSION_MAX_ATTEMPTS: parsedEnv.CONVERSION_MAX_ATTEMPTS,
  CONVERSION_BACKOFF_DELAY: parsedEnv.CONVERSION_BACKOFF_DELAY,

  // External Transport (Sentry)
  SENTRY_DSN: parsedEnv.SENTRY_DSN,
  SENTRY_TRACES_SAMPLE_RATE: parsedEnv.SENTRY_TRACES_SAMPLE_RATE,
};

// ── Startup banner (safe — no secrets, DSNs, passwords, or tokens) ──
console.log("✅ [ENV] Validation Success");
console.log(`   NODE_ENV:      ${env.NODE_ENV}`);
console.log(`   APS_MOCK:      ${env.APS_MOCK}`);
console.log(`   Redis:         ${redisMode}`);
console.log(
  `   SMTP:          ${smtpConfigured ? "configured" : "not configured"}`,
);
console.log(
  `   Frontend URL:  ${parsedEnv.FRONTEND_URL ? "configured" : "default (localhost:3000)"}`,
);
console.log(`   Admin emails:  ${adminEmailsList.length} configured`);
