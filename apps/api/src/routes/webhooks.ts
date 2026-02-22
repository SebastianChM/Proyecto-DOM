import { Router, Request, Response } from "express";
import { validateApsWebhookSignature } from "../middleware/hmac-validation.middleware";
import { webhookProcessorService } from "../services/webhooks/webhook-processor.service";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Rate limiter for webhook endpoints
 * Prevents abuse while allowing legitimate APS webhook traffic
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: "WEBHOOK_RATE_LIMITED",
    code: "TOO_MANY_REQUESTS",
    message: "Too many webhook requests",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/webhooks/aps/callback
 *
 * APS Design Automation Callback
 * Handles job completion notifications from Design Automation API
 *
 * Security:
 * - HMAC signature validation required
 * - Rate limited (100 req/min per IP)
 * - NO full payload logging
 *
 * Response:
 * - 202 Accepted: Webhook enqueued for processing
 * - 400 Bad Request: Invalid payload structure
 * - 401 Unauthorized: Missing HMAC signature
 * - 403 Forbidden: Invalid HMAC signature
 * - 500 Internal Error: Processing failed
 */
router.post(
  "/aps/callback",
  webhookLimiter,
  validateApsWebhookSignature,
  async (req: Request, res: Response) => {
    const requestId =
      (req.headers["x-request-id"] as string) || crypto.randomUUID();
    const startTime = Date.now();

    try {
      const payload = req.body;

      // Minimal validation - check payload structure
      if (!payload || !payload.id || !payload.status) {
        logger.warn("[WEBHOOK] Invalid callback payload structure", {
          requestId,
          hasId: !!payload?.id,
          hasStatus: !!payload?.status,
        });

        return res.status(400).json({
          error: "WEBHOOK_VALIDATION_ERROR",
          code: "INVALID_PAYLOAD",
          message: "Invalid payload structure",
          requestId,
          status: 400,
        });
      }

      // Process webhook asynchronously via queue
      const result = await webhookProcessorService.processIncomingWebhook(
        "APS",
        "design-automation.callback",
        payload,
        requestId,
      );

      const durationMs = Date.now() - startTime;

      // CRITICAL: Must respond in < 5 seconds
      res.status(202).json({
        accepted: true,
        deliveryId: result.deliveryId,
        status: result.status,
        requestId,
        durationMs,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      logger.error("[WEBHOOK] Callback processing error", {
        requestId,
        error: msg.substring(0, 200),
        durationMs,
      });

      res.status(500).json({
        error: "WEBHOOK_PROCESSING_ERROR",
        code: "INTERNAL_ERROR",
        message: "Failed to process webhook",
        requestId,
        status: 500,
      });
    }
  },
);

/**
 * POST /api/webhooks/aps/data/callback
 *
 * APS Data Management Webhook
 * Handles version added notifications (dm.version.added)
 *
 * Security:
 * - HMAC signature validation required
 * - Rate limited (100 req/min per IP)
 * - NO full payload logging
 *
 * Response:
 * - 202 Accepted: Webhook enqueued for processing
 * - 400 Bad Request: Invalid payload structure
 * - 401 Unauthorized: Missing HMAC signature
 * - 403 Forbidden: Invalid HMAC signature
 * - 500 Internal Error: Processing failed
 */
router.post(
  "/aps/data/callback",
  webhookLimiter,
  validateApsWebhookSignature,
  async (req: Request, res: Response) => {
    const requestId =
      (req.headers["x-request-id"] as string) || crypto.randomUUID();
    const startTime = Date.now();

    try {
      const payload = req.body;

      // Minimal validation - check payload structure
      if (!payload || !payload.hook || !payload.payload) {
        logger.warn("[WEBHOOK] Invalid data callback payload structure", {
          requestId,
          hasHook: !!payload?.hook,
          hasPayload: !!payload?.payload,
        });

        return res.status(400).json({
          error: "WEBHOOK_VALIDATION_ERROR",
          code: "INVALID_PAYLOAD",
          message: "Invalid payload structure",
          requestId,
          status: 400,
        });
      }

      const eventType = payload.hook.event as string;

      // Process webhook asynchronously via queue
      const result = await webhookProcessorService.processIncomingWebhook(
        "APS",
        eventType,
        payload,
        requestId,
      );

      const durationMs = Date.now() - startTime;

      // CRITICAL: Must respond in < 5 seconds
      res.status(202).json({
        accepted: true,
        deliveryId: result.deliveryId,
        status: result.status,
        requestId,
        durationMs,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      logger.error("[WEBHOOK] Data callback error", {
        requestId,
        error: msg.substring(0, 200),
        durationMs,
      });

      res.status(500).json({
        error: "WEBHOOK_PROCESSING_ERROR",
        code: "INTERNAL_ERROR",
        message: "Failed to process webhook",
        requestId,
        status: 500,
      });
    }
  },
);

export default router;
