/**
 * Structured Logger
 *
 * Professional logging utility that respects LOG_LEVEL environment variable.
 * Replaces console.log/warn/error with structured, level-aware logging.
 *
 * Levels (in order of severity):
 * - debug: Detailed debugging info (development only)
 * - info: General information and success messages
 * - warn: Warning messages (non-critical issues)
 * - error: Error messages (failures, exceptions)
 */

import { env } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

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

function formatMessage(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, meta));
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, meta));
    }
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, meta));
    }
  },

  error(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, meta));
    }
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
