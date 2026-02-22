import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Validate APS webhook HMAC signature
 *
 * APS sends webhooks with x-adsk-signature header in format: "sha1hash=<hex>"
 * We validate using HMAC-SHA256 with the raw request body
 *
 * Security rules:
 * - NO logging of signature values
 * - NO logging of request body/payload
 * - Uses timing-safe comparison
 * - Rejects if secret not configured
 */
export const validateApsWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId =
    (req.headers["x-request-id"] as string) || crypto.randomUUID();

  // Extract signature header (format: "sha1hash=<signature>")
  const signatureHeader = req.headers["x-adsk-signature"] as string;

  if (!signatureHeader) {
    logger.warn("[WEBHOOK_HMAC] Missing signature header", {
      requestId,
      route: req.path,
      ip: req.ip,
    });

    return res.status(401).json({
      error: "WEBHOOK_AUTH_ERROR",
      code: "MISSING_SIGNATURE",
      message: "Webhook signature required",
      requestId,
      status: 401,
    });
  }

  if (!env.APS_WEBHOOK_SIGNING_SECRET) {
    logger.error("[WEBHOOK_HMAC] APS_WEBHOOK_SIGNING_SECRET not configured");
    return res.status(500).json({
      error: "WEBHOOK_CONFIG_ERROR",
      code: "SECRET_NOT_CONFIGURED",
      message: "Webhook signing secret not configured",
      requestId,
      status: 500,
    });
  }

  // Extract signature value (remove "sha1hash=" prefix if present)
  const receivedSignature = signatureHeader.replace(/^sha1hash=/, "");

  // Get raw body (must be captured by captureRawBody middleware)
  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    logger.error("[WEBHOOK_HMAC] Raw body not captured", { requestId });
    return res.status(500).json({
      error: "WEBHOOK_ERROR",
      code: "RAW_BODY_MISSING",
      message: "Internal error: raw body not captured",
      requestId,
      status: 500,
    });
  }

  // Calculate expected signature using HMAC-SHA256
  const hmac = crypto.createHmac("sha256", env.APS_WEBHOOK_SIGNING_SECRET);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest("hex");

  // Timing-safe comparison to prevent timing attacks
  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  } catch (error) {
    // Buffer length mismatch or invalid hex
    logger.warn("[WEBHOOK_HMAC] Signature format error", {
      requestId,
      route: req.path,
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(403).json({
      error: "WEBHOOK_AUTH_ERROR",
      code: "INVALID_SIGNATURE_FORMAT",
      message: "Webhook signature format invalid",
      requestId,
      status: 403,
    });
  }

  if (!isValid) {
    logger.warn("[WEBHOOK_HMAC] Invalid signature", {
      requestId,
      route: req.path,
      ip: req.ip,
      signatureValid: false,
    });

    return res.status(403).json({
      error: "WEBHOOK_AUTH_ERROR",
      code: "INVALID_SIGNATURE",
      message: "Webhook signature validation failed",
      requestId,
      status: 403,
    });
  }

  // Signature valid - log success (NO signature values)
  logger.debug("[WEBHOOK_HMAC] Valid signature", {
    requestId,
    route: req.path,
    signatureValid: true,
  });

  next();
};
