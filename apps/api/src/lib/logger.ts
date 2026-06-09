/**
 * Structured Logger
 *
 * Professional logging utility that respects LOG_LEVEL environment variable.
 * Replaces console.log/warn/error with structured, level-aware logging.
 *
 * All metadata is automatically redacted before serialization:
 * - Sensitive keys (tokens, secrets, passwords) → "[REDACTED]"
 * - Emails → masked ("ch\*\*\*@gmail.com")
 * - User IDs → truncated ("550e8400…")
 *
 * Levels (in order of severity):
 * - debug: Detailed debugging info (development only)
 * - info: General information and success messages
 * - warn: Warning messages (non-critical issues)
 * - error: Error messages (failures, exceptions)
 */

import { env } from "../config/env";
import { redactMeta } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[env.LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

// ── External transport hook (Sentry / Datadog / etc.) ───────────────
// Call setTransport() once at startup to forward logs to an external service.
// The transport receives the ALREADY-REDACTED meta so it never sees secrets.
type TransportFn = (
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) => void;
let externalTransport: TransportFn | null = null;

export function setTransport(fn: TransportFn): void {
  externalTransport = fn;
}

// ── Format ──────────────────────────────────────────────────────────
function formatMessage(
  level: LogLevel,
  message: string,
  safeMeta?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const metaStr = safeMeta ? ` ${JSON.stringify(safeMeta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

function emit(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const safe = meta ? redactMeta(meta) : undefined;
  console[level](formatMessage(level, message, safe));
  if (externalTransport) externalTransport(level, message, safe);
}

// ── Request context helper ──────────────────────────────────────────
interface ReqLike {
  headers: Record<string, unknown>;
  method: string;
  path: string;
  originalUrl?: string;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    emit("debug", message, meta);
  },

  info(message: string, meta?: Record<string, unknown>): void {
    emit("info", message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    emit("warn", message, meta);
  },

  error(message: string, meta?: Record<string, unknown>): void {
    emit("error", message, meta);
  },

  /**
   * Extract common request context for log meta.
   * Spread into any logger call: `logger.info("msg", { ...logger.fromReq(req), extra })`.
   */
  fromReq(req: ReqLike): { requestId: unknown; method: string; path: string } {
    return {
      requestId: req.headers["x-request-id"],
      method: req.method,
      path: req.originalUrl?.split("?")[0] ?? req.path,
    };
  },

  // Worker-specific logging helpers
  worker: {
    start(
      workerName: string,
      jobId: string,
      meta?: Record<string, unknown>,
    ): void {
      logger.info(`[${workerName}] Starting job`, { jobId, ...meta });
    },

    complete(
      workerName: string,
      jobId: string,
      durationMs: number,
      meta?: Record<string, unknown>,
    ): void {
      logger.info(`[${workerName}] ✅ Job completed`, {
        jobId,
        durationMs,
        ...meta,
      });
    },

    fail(
      workerName: string,
      jobId: string,
      error: string,
      meta?: Record<string, unknown>,
    ): void {
      logger.error(`[${workerName}] ❌ Job failed`, {
        jobId,
        error: error.substring(0, 200),
        ...meta,
      });
    },
  },

  // API-specific logging helpers
  api: {
    request(
      method: string,
      path: string,
      meta?: Record<string, unknown>,
    ): void {
      logger.debug(`${method} ${path}`, meta);
    },

    response(
      method: string,
      path: string,
      statusCode: number,
      durationMs: number,
    ): void {
      const level =
        statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "debug";
      logger[level](`${method} ${path} ${statusCode}`, { durationMs });
    },
  },
};

export default logger;
