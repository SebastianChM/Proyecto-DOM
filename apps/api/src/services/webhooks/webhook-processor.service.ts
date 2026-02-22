import prisma from "../../lib/prisma";
import { Queues } from "../../lib/queue";
import crypto from "crypto";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

/**
 * Webhook Processor Service
 *
 * Handles incoming webhook events with:
 * - Idempotency via dedupe keys
 * - Sanitized logging (NO full payloads, NO tokens)
 * - Queue-based async processing
 * - Delivery tracking and persistence
 *
 * Security: Never logs sensitive data (tokens, secrets, full payloads)
 */
export class WebhookProcessorService {
  /**
   * Sanitize webhook log - extract only safe fields
   * CRITICAL: NO full payload, NO sensitive headers
   */
  sanitizeWebhookLog(payload: Record<string, unknown>) {
    const hook = (payload?.hook as Record<string, unknown>) || {};

    return {
      hookId: hook.hookId || null,
      eventType: hook.event || null,
      deliveryId: hook.deliveryId || null,
      hasPayload: !!payload.payload,
      // DO NOT include full payload body
    };
  }

  /**
   * Generate stable dedupe key for idempotency
   * Format: provider:eventType:hookId:deliveryId
   */
  generateDedupeKey(
    provider: string,
    eventType: string,
    hookId: string,
    deliveryId: string,
  ): string {
    return `${provider}:${eventType}:${hookId}:${deliveryId}`;
  }

  /**
   * Process incoming webhook - persist and enqueue
   * Returns 202 if successful, throws on error
   *
   * Flow:
   * 1. Extract IDs and generate dedupe key
   * 2. Check for duplicate (idempotency)
   * 3. Persist delivery record
   * 4. Enqueue job for async processing
   * 5. Return 202 accepted
   */
  async processIncomingWebhook(
    provider: string,
    eventType: string,
    payload: Record<string, unknown>,
    requestId: string,
  ): Promise<{ deliveryId: string; status: string }> {
    const startTime = Date.now();

    // Extract IDs from payload
    const hook = (payload?.hook as Record<string, unknown>) || {};
    const hookId = (hook.hookId as string) || "";
    const deliveryId = (hook.deliveryId as string) || crypto.randomUUID();

    // Generate dedupe key for idempotency
    const dedupeKey = this.generateDedupeKey(
      provider,
      eventType,
      hookId,
      deliveryId,
    );

    // Check idempotency - have we seen this webhook before?
    const existing = await prisma.webhookDelivery.findUnique({
      where: { dedupeKey },
    });

    if (existing) {
      if (env.LOG_LEVEL === "debug") {
        logger.debug("[WEBHOOK] Duplicate delivery detected", {
          requestId,
          dedupeKey,
          existingId: existing.id,
          existingStatus: existing.status,
        });
      }

      return {
        deliveryId: existing.id,
        status: "DUPLICATE",
      };
    }

    // Persist delivery record BEFORE enqueueing
    const delivery = await prisma.webhookDelivery.create({
      data: {
        provider,
        eventType,
        hookId,
        deliveryId,
        dedupeKey,
        status: "PENDING",
        requestId,
        receivedAt: new Date(),
      },
    });

    // Enqueue job for async processing
    await Queues.apsWebhooks.add(
      eventType,
      {
        eventType,
        payload,
        deliveryId: delivery.id,
        requestId,
      },
      {
        jobId: delivery.id, // Use delivery ID as job ID for correlation
      },
    );

    const durationMs = Date.now() - startTime;

    // Log with sanitized data only
    const sanitized = this.sanitizeWebhookLog(payload);
    logger.debug("[WEBHOOK] Enqueued webhook job", {
      requestId,
      durationMs,
      ...sanitized,
    });

    return {
      deliveryId: delivery.id,
      status: "ENQUEUED",
    };
  }

  /**
   * Create notification event
   * Decoupled from User notifications for audit and replay
   */
  async createNotification(
    type: string,
    projectId: string | null,
    resourceId: string | null,
    payload: Record<string, unknown>,
  ) {
    await prisma.notificationEvent.create({
      data: {
        type,
        projectId,
        resourceId,
        payload: JSON.stringify(payload),
      },
    });

    if (env.LOG_LEVEL === "debug") {
      logger.debug("[NOTIFICATION] Created event", {
        type,
        projectId,
        resourceId,
      });
    }
  }
}

export const webhookProcessorService = new WebhookProcessorService();
