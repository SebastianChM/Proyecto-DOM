/**
 * Design Automation Callback Routes (Hito 5)
 *
 * Hardened DA callback with:
 * - Exact workItemId matching (NO substring) - Hito 5 Note 13
 * - Idempotency via dedupeKey - Hito 5 Note 15
 * - Fast async processing (202 response) - Hito 5 Note 14
 * - Secure validation - Hito 5 Note 16
 */

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { Queues } from "../lib/queue";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /design-automation/callback
 * Receive Design Automation work item status updates
 *
 * CRITICAL (Hito 5 Note 13): Uses EXACT workItemId matching, no substring!
 */
router.post(
  "/design-automation/callback",
  async (req: Request, res: Response) => {
    try {
      const { workItemId, status, reportUrl } = req.body;

      // Validate payload schema
      if (!workItemId || !status) {
        logger.warn(
          "[DA_CALLBACK] Invalid payload: missing workItemId or status",
        );
        return res
          .status(400)
          .json({ error: "Invalid payload: workItemId and status required" });
      }

      // Sanitized log (Hito 5 Note 12: NO full body)
      logger.debug("[DA_CALLBACK] Received", {
        workItemId: workItemId.substring(0, 30) + "...",
        status,
        hasReportUrl: !!reportUrl,
      });

      // CRITICAL: Exact match ONLY (Hito 5 Note 13)
      // ❌ NO substring: where: { resultUrl: { contains: workItemId } }
      // ✅ YES exact: where: { workItemId: workItemId }
      const conversion = await prisma.conversion.findFirst({
        where: { workItemId: workItemId }, // Exact equality!
      });

      if (!conversion) {
        logger.warn("[DA_CALLBACK] Unknown workItemId", {
          workItemId: workItemId.substring(0, 30),
        });
        return res
          .status(404)
          .json({ error: "Conversion not found for workItemId" });
      }

      // Idempotency check (Hito 5 Note 15)
      const dedupeKey = `DA:${workItemId}:${status}`;

      const existingDelivery = await prisma.conversion.findFirst({
        where: { dedupeKey },
      });

      if (existingDelivery) {
        logger.debug(
          "[DA_CALLBACK] Duplicate callback detected, returning 200",
          {
            workItemId: workItemId.substring(0, 30),
            dedupeKey,
          },
        );
        return res
          .status(200)
          .json({ message: "Already processed (idempotent)" });
      }

      // Persist minimal delivery record
      await prisma.conversion.update({
        where: { id: conversion.id },
        data: { dedupeKey },
      });

      // Respond quickly (Hito 5 Note 14: 202 Accepted, async processing)
      res.status(202).json({ accepted: true, conversionId: conversion.id });

      // Enqueue for async processing (DO NOT process in HTTP request!)
      await Queues.designAutomationCallback.add("process-da-callback", {
        conversionId: conversion.id,
        workItemId,
        status,
        reportUrl,
      });

      logger.info("[DA_CALLBACK] Enqueued for processing", {
        conversionId: conversion.id,
        status,
      });
    } catch (error) {
      logger.error("[DA_CALLBACK] Error", {
        error:
          error instanceof Error ? error.message.substring(0, 200) : "Unknown",
      });

      res.status(500).json({
        error: "Callback processing failed",
      });
    }
  },
);

/**
 * Worker to process DA callbacks asynchronously
 * This would be in workers/da-callback.worker.ts in production
 * Included here for completeness
 */
export async function processDesignAutomationCallback(data: {
  conversionId: string;
  workItemId: string;
  status: string;
  reportUrl?: string;
}) {
  const { conversionId, status, reportUrl } = data;

  try {
    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
    });

    if (!conversion) {
      logger.error("[DA_CALLBACK_WORKER] Conversion not found", {
        conversionId,
      });
      return { success: false, error: "Conversion not found" };
    }

    // Update conversion based on DA status
    if (status === "completed" || status === "success") {
      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          resultUrl: reportUrl || null,
        },
      });

      logger.info("[DA_CALLBACK_WORKER] Conversion completed", {
        conversionId,
      });
      return { success: true, status: "COMPLETED" };
    } else if (status === "failed" || status === "cancelled") {
      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          lastError: `DA work item ${status}`,
        },
      });

      logger.warn("[DA_CALLBACK_WORKER] Conversion failed", {
        conversionId,
        status,
      });
      return { success: false, status: "FAILED" };
    }

    // Other statuses (inprogress, pending) - keep PROCESSING
    return { success: true, status: "PROCESSING" };
  } catch (error) {
    logger.error("[DA_CALLBACK_WORKER] Error", {
      conversionId,
      error:
        error instanceof Error ? error.message.substring(0, 200) : "Unknown",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown",
    };
  }
}

export default router;
