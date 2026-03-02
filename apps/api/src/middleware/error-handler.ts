import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { AppError } from "../lib/errors";
import { WorkflowError } from "../services/workflow.service";
import { ApsError } from "../services/aps/aps-error";

// ─── Types ──────────────────────────────────────────────────────────

interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
  stack?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

/** Duck-type check for ZodError (works with both Zod v3 and v4). */
function isZodError(err: unknown): err is Error & { issues: unknown[] } {
  return (
    err instanceof Error &&
    err.name === "ZodError" &&
    Array.isArray((err as unknown as Record<string, unknown>).issues)
  );
}

// ─── Main handler ───────────────────────────────────────────────────

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = (req.headers["x-request-id"] as string) || undefined;

  let statusCode: number;
  let body: ErrorResponse;

  // ── AppError (standard application error) ─────────────────────
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    body = {
      error: err.error,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    };

    // ── WorkflowError ─────────────────────────────────────────────
  } else if (err instanceof WorkflowError) {
    statusCode = err.statusCode;
    body = {
      error: "WorkflowError",
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    };

    // ── ApsError (Autodesk Platform Services) ─────────────────────
  } else if (err instanceof ApsError) {
    statusCode = err.status;
    body = {
      error: "ApsError",
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    };

    // ── ZodError (request validation) ─────────────────────────────
  } else if (isZodError(err)) {
    statusCode = 400;
    body = {
      error: "ValidationError",
      message: "Request validation failed",
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
    body = {
      error: "InternalServerError",
      // In production hide raw messages for 5xx to prevent info leaks
      message:
        statusCode >= 500 && !isDev ? "Internal Server Error" : rawMessage,
    };
  }

  // ── Attach requestId & dev stack ──────────────────────────────
  if (requestId) body.requestId = requestId;
  if (isDev && err instanceof Error) body.stack = err.stack;

  // ── Structured logging (5xx = error, 4xx = warn) ─────────────
  const logPayload = {
    statusCode,
    error: body.error,
    message: body.message,
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
