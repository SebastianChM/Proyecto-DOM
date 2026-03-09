import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { AppError } from "../lib/errors";
import { WorkflowError } from "../services/workflow.service";
import { ApsError } from "../services/aps/aps-error";

// ─── Types ──────────────────────────────────────────────────────────

interface ErrorResponse {
  /** Human-readable error message (backward-compatible with legacy { error } shape) */
  error: string;
  /** Error category: "NotFound", "Unauthorized", "BadRequest", etc. */
  type: string;
  /** Optional longer description (may duplicate error) */
  message?: string;
  code?: string;
  details?: unknown;
  requestId?: string;
  stack?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

/** Duck-type check for ZodError (works with both Zod v3 and v4). */
function isZodError(err: unknown): err is { name: string; issues: unknown[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as Record<string, unknown>).name === "ZodError" &&
    Array.isArray((err as Record<string, unknown>).issues)
  );
}

// ─── Main handler ───────────────────────────────────────────────────

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
) => {
  const requestId = (req.headers["x-request-id"] as string) || undefined;

  let statusCode: number;
  let body: ErrorResponse;

  // ── AppError (standard application error) ─────────────────────
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    body = {
      error: err.message,
      type: err.type,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    };

    // ── WorkflowError ─────────────────────────────────────────────
  } else if (err instanceof WorkflowError) {
    statusCode = err.statusCode;
    body = {
      error: err.message,
      type: "WorkflowError",
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    };

    // ── ApsError (Autodesk Platform Services) ─────────────────────
  } else if (err instanceof ApsError) {
    statusCode = err.status;
    body = {
      error: err.message,
      type: "ApsError",
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    };

    // ── ZodError (request validation) ─────────────────────────────
  } else if (isZodError(err)) {
    statusCode = 400;
    body = {
      error: "Validation failed",
      type: "BadRequest",
      code: "VALIDATION_ERROR",
      details: err.issues,
    };

    // ── Generic Error / unknown ───────────────────────────────────
  } else {
    statusCode =
      (err as { statusCode?: number }).statusCode ||
      (err as { status?: number }).status ||
      500;
    const rawMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    const humanMessage =
      statusCode >= 500 && !isDev ? "Internal Server Error" : rawMessage;
    body = {
      error: humanMessage,
      type: statusCode >= 500 ? "InternalServerError" : "Error",
    };
  }

  // ── Attach requestId & dev stack ──────────────────────────────
  if (requestId) body.requestId = requestId;
  if (isDev && err instanceof Error) body.stack = err.stack;

  // ── Structured logging (5xx = error, 4xx = warn) ─────────────
  const logPayload = {
    statusCode,
    type: body.type,
    error: body.error,
    code: body.code,
    method: req.method,
    path: req.path,
    requestId,
  };

  if (statusCode >= 500) {
    logger.error("[ERROR_HANDLER] Server error", logPayload);
  } else {
    logger.warn("[ERROR_HANDLER] Client error", logPayload);
  }

  res.status(statusCode).json(body);
};
