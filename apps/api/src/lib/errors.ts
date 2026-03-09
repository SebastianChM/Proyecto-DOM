/**
 * Standardized application error class.
 *
 * Thrown inside route handlers (wrapped by asyncHandler) or services.
 * The global error handler serialises it as:
 *   { error: <human message>, type: <category>, code?, details?, requestId?, stack? }
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    /** Error category, e.g. "NotFound", "Unauthorized" */
    public readonly type: string,
    /** Human-readable message for the client (becomes the `error` field in the response) */
    message: string,
    /** Machine-readable code, e.g. "PROJECT_NOT_FOUND" */
    public readonly code?: string,
    /** Extra payload (Zod issues, field info, …) */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Factory helpers ────────────────────────────────────────────────

export const badRequest = (
  message: string,
  code?: string,
  details?: unknown,
) => new AppError(400, "BadRequest", message, code, details);

export const unauthorized = (message = "Authentication required") =>
  new AppError(401, "Unauthorized", message);

export const forbidden = (message = "Forbidden") =>
  new AppError(403, "Forbidden", message);

export const notFound = (message: string, code?: string) =>
  new AppError(404, "NotFound", message, code);

export const conflict = (message: string, code?: string) =>
  new AppError(409, "Conflict", message, code);

export const tooManyRequests = (message = "Too many requests") =>
  new AppError(429, "TooManyRequests", message);

export const internal = (message = "Internal server error", code?: string) =>
  new AppError(500, "InternalServerError", message, code);

export const serviceUnavailable = (
  message = "Service temporarily unavailable",
  code?: string,
) => new AppError(503, "ServiceUnavailable", message, code);
