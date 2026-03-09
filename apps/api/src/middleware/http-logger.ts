/**
 * HTTP Request Lifecycle Logger
 *
 * Express middleware that replaces Morgan with structured, level-aware logging.
 * Logs on response finish (not on request arrival) so that statusCode and
 * duration are available.
 *
 * Levels:
 * - debug: quiet paths (/health, /favicon.ico, /api-docs, /downloads)
 * - info:  2xx / 3xx
 * - warn:  4xx
 * - error: 5xx
 *
 * Never logs request/response bodies.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { truncateId } from "../lib/redact";
import { CONSTANTS } from "../config/constants";

const QUIET_PATHS = CONSTANTS.OBSERVABILITY.QUIET_PATHS;

function isQuietPath(path: string): boolean {
  return QUIET_PATHS.some((qp) => path.startsWith(qp));
}

export const httpLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const start = Date.now();

  // Use the "finish" event — fires when the response is fully written.
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const quiet = isQuietPath(req.path);

    // Determine level
    let level: "debug" | "info" | "warn" | "error";
    if (quiet && status < 400) {
      level = "debug";
    } else if (status >= 500) {
      level = "error";
    } else if (status >= 400) {
      level = "warn";
    } else {
      level = "info";
    }

    const meta: Record<string, unknown> = {
      requestId: req.headers["x-request-id"],
      duration,
    };

    // Content-Length if set
    const cl = res.getHeader("content-length");
    if (cl !== undefined) {
      meta.contentLength = cl;
    }

    // userId — only if authenticated, already truncated for PII
    const userId = req.session?.user?.id;
    if (userId && typeof userId === "string") {
      meta.userId = truncateId(userId);
    }

    logger[level](`${req.method} ${req.path} ${status} ${duration}ms`, meta);
  });

  next();
};
