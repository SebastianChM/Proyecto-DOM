/**
 * Frontend Logger - Development-only logging
 *
 * Wraps console.* methods so they only output in development.
 * In production builds, all logs are silenced to avoid leaking
 * internal details to end-user browser consoles.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Something happened", { details });
 *   logger.error("Failed to load", { error: err.message });
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (isDev) console.debug(`[DEBUG] ${message}`, meta ?? "");
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (isDev) console.info(`[INFO] ${message}`, meta ?? "");
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (isDev) console.warn(`[WARN] ${message}`, meta ?? "");
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    // Errors always log (even in production) for debugging
    console.error(`[ERROR] ${message}`, meta ?? "");
  },
};
