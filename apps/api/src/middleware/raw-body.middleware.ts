import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Capture raw body before JSON parsing for HMAC validation
 * CRITICAL: Must be applied BEFORE express.json() middleware
 *
 * Stores the raw buffer in req.rawBody for signature validation
 */
export const captureRawBody = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    (req as any).rawBody = Buffer.concat(chunks);
    next();
  });

  req.on("error", (err: Error) => {
    logger.error("[RAW_BODY] Error capturing raw body", { error: err.message });
    next(err);
  });
};
