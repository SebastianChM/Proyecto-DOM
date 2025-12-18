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
