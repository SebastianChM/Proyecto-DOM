import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async Express route handler so that rejected promises are
 * forwarded to the global error-handling middleware via next(err).
 *
 * Usage:
 *   router.get("/foo", asyncHandler(async (req, res) => { … }));
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
