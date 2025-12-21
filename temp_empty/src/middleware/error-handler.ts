import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // console.error(err); // Use a proper logger in production

  const error = err as {
    statusCode?: number;
    message?: string;
    stack?: string;
    details?: unknown;
  };

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  // Don't leak stack traces in production
  const response = {
    error: message,
    ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {}),
    ...(error.details ? { details: error.details } : {}),
  };

  res.status(statusCode).json(response);
};
