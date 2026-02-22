import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const error = err as {
    statusCode?: number;
    message?: string;
    stack?: string;
    details?: unknown;
  };

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  logger.error("[ERROR_HANDLER] Unhandled error", {
    statusCode,
    message,
    method: req.method,
    path: req.path,
    requestId: req.headers["x-request-id"],
  });

  // Don't leak stack traces in production
  const response = {
    error: message,
    ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {}),
    ...(error.details ? { details: error.details } : {}),
  };

  res.status(statusCode).json(response);
};
