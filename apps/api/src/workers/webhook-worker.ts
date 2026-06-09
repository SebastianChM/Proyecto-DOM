import { Worker, Job } from "bullmq";
import { ApsWebhookJobData } from "../lib/queue";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { modelDerivativeService } from "../services/aps/model-derivative.service";
import { apsAuthService } from "../services/aps/auth.service";
import { apsDataManagementService } from "../services/aps/data-management.service";
import { webhookProcessorService } from "../services/webhooks/webhook-processor.service";
import { env } from "../config/env";
import { CONSTANTS } from "../config/constants";

const WORKER_NAME = "WEBHOOK_WORKER";

/**
 * APS Webhooks Worker
 *
 * Processes webhook events asynchronously from the aps-webhooks queue
 *
 * Handles:
 * - design-automation.callback: Design Automation job completion
 * - dm.version.added: New version added to project
 *
 * Features:
 * - Retry with exponential backoff
 * - Delivery status tracking
 * - Sanitized error logging (NO tokens, NO full payloads)
 * - Notification generation
 *
 * Security: Never logs sensitive data
 */

const redisConfig = {
  host: env.REDIS_HOST || CONSTANTS.REDIS.DEFAULT_HOST,
  port: env.REDIS_PORT || CONSTANTS.REDIS.DEFAULT_PORT,
  password: env.REDIS_PASSWORD,
};

const worker = new Worker<ApsWebhookJobData>(
  "aps-webhooks",
  async (job: Job<ApsWebhookJobData>) => {
    const { eventType, payload, deliveryId, requestId } = job.data;

    logger.info(`[${WORKER_NAME}] Processing job`, {
      jobId: job.id,
      eventType,
      deliveryId,
      requestId,
    });

    try {
      if (eventType === "design-automation.callback") {
        await handleDesignAutomationCallback(payload, deliveryId, requestId);
      } else if (eventType === "dm.version.added") {
        await handleVersionAdded(payload, deliveryId, requestId);
      } else {
        logger.warn(`[${WORKER_NAME}] Unknown event type`, {
          eventType,
          requestId,
        });
      }

      // Mark as processed
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const shortError = msg.substring(0, 500);

      // Persist failure status in a nested try/catch so that a secondary DB error
      // never swallows the original error — BullMQ must always see the real cause.
      try {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            attempts: { increment: 1 },
            lastError: shortError,
            status: "FAILED",
          },
        });
      } catch (dbErr: unknown) {
        logger.error(`[${WORKER_NAME}] Failed to persist job failure status`, {
          jobId: job.id,
          deliveryId,
          dbError: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      }

      logger.error(`[${WORKER_NAME}] Job failed`, {
        jobId: job.id,
        eventType,
        deliveryId,
        error: shortError,
      });

      throw error; // Always rethrow original error — triggers BullMQ retry
    }
  },
  {
    connection: redisConfig,
    prefix: "dom-bim",
    concurrency: env.WEBHOOK_QUEUE_CONCURRENCY,
  },
);

/**
 * Handle Design Automation Callback
 * Updates conversion status and triggers file status updates
 */
async function handleDesignAutomationCallback(
  payload: Record<string, unknown>,
  deliveryId: string,
  requestId: string,
) {
  const status = payload.status as string;
  const workItemId = payload.id as string;

  logger.info(`[${WORKER_NAME}] Processing DA callback`, {
    workItemId,
    status,
    requestId,
  });

  // Find conversion by exact workItemId match
  const conversion = await prisma.conversion.findFirst({
    where: {
      workItemId: workItemId,
    },
  });

  if (!conversion) {
    logger.warn(`[${WORKER_NAME}] Conversion not found`, {
      workItemId,
      requestId,
    });
    return;
  }

  if (status === "success") {
    logger.info(`[${WORKER_NAME}] DA job completed successfully`, {
      conversionId: conversion.id,
      requestId,
    });

    // Idempotency guard: a previous BullMQ attempt already completed this
    // conversion — skip all writes including notification to prevent duplicates.
    if (conversion.status === "COMPLETED") {
      logger.debug(`[${WORKER_NAME}] DA callback already processed, skipping`, {
        conversionId: conversion.id,
        requestId,
      });
      return;
    }

    const parts = conversion.resultUrn?.split(":");
    const outputObjectKey = parts && parts.length >= 3 ? parts[2] : null;

    if (outputObjectKey) {
      await prisma.conversion.update({
        where: { id: conversion.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      await prisma.file.update({
        where: { id: conversion.fileId },
        data: { status: "READY" },
      });

      // Create notification
      await webhookProcessorService.createNotification(
        "CONVERSION_COMPLETE",
        null,
        conversion.fileId,
        { conversionId: conversion.id, status: "success" },
      );

      logger.info(`[${WORKER_NAME}] Conversion completed`, {
        conversionId: conversion.id,
        fileId: conversion.fileId,
      });
    }
  } else if (status === "failed" || status === "cancelled") {
    logger.warn(`[${WORKER_NAME}] DA job failed or cancelled`, {
      conversionId: conversion.id,
      status,
      requestId,
    });

    await prisma.conversion.update({
      where: { id: conversion.id },
      data: { status: "FAILED", completedAt: new Date() },
    });

    await prisma.file.update({
      where: { id: conversion.fileId },
      data: { status: "FAILED" },
    });
  }
}

/**
 * Handle Version Added Event
 * Inserts new file version and triggers SVF2 translation
 */
async function handleVersionAdded(
  payload: Record<string, unknown>,
  deliveryId: string,
  requestId: string,
) {
  const eventPayload = payload.payload as Record<string, unknown>;
  const projectId = eventPayload.project as string;
  const versionId = eventPayload.version as string;
  const urn = (eventPayload.resourceUrn as string) || "";

  logger.info(`[${WORKER_NAME}] Processing version added`, {
    projectId,
    versionId: versionId.substring(0, 20) + "...",
    requestId,
  });

  // Find local project mapping
  const localProject = await prisma.file.findFirst({
    where: { apsProjectId: projectId },
    select: { projectId: true },
  });

  if (!localProject) {
    logger.warn(`[${WORKER_NAME}] No local project mapping`, {
      projectId,
      requestId,
    });
    return;
  }

  const localProjectId = localProject.projectId;

  // Check if version already exists
  const existingFile = await prisma.file.findFirst({
    where: { apsUrn: urn },
  });

  if (existingFile) {
    // If status is still UPLOADED the previous attempt created the file record
    // but crashed before enqueueing SVF2 translation.  Re-enqueue now so the
    // file is never permanently frozen in UPLOADED.
    if (existingFile.status === "UPLOADED") {
      logger.info(
        `[${WORKER_NAME}] File exists but not yet translated, re-enqueueing`,
        {
          fileId: existingFile.id,
          requestId,
        },
      );
      try {
        await modelDerivativeService.translateToSVF2(urn);
        await prisma.file.update({
          where: { id: existingFile.id },
          data: { status: "TRANSLATING" },
        });
        logger.info(`[${WORKER_NAME}] Rescued SVF2 translation`, {
          fileId: existingFile.id,
        });
      } catch (error) {
        logger.error(`[${WORKER_NAME}] Failed to rescue translation`, {
          fileId: existingFile.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      logger.debug(
        `[${WORKER_NAME}] File version already exists and is being processed`,
        {
          fileId: existingFile.id,
          status: existingFile.status,
          urn: urn.substring(0, 30) + "...",
        },
      );
    }
    return;
  }

  // Fetch version details from APS
  let fileName = `File ${versionId.substring(0, 8)}`;
  let fileType = "RVT";
  let fileSize = 0;

  try {
    const token = await apsAuthService.getInternalToken();
    const versionDetails = await apsDataManagementService.getVersion(
      projectId,
      versionId,
      token,
    );

    fileName = versionDetails.fileName || fileName;
    fileType = versionDetails.fileType || fileType;
    fileSize = versionDetails.storageSize || 0;
  } catch (error) {
    logger.warn(`[${WORKER_NAME}] Failed to fetch version details`, {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });
  }

  // Create file record
  const newFile = await prisma.file.create({
    data: {
      name: fileName,
      originalName: fileName,
      type: fileType,
      size: fileSize,
      apsUrn: urn,
      status: "UPLOADED",
      origin: "ACC",
      apsProjectId: projectId,
      apsItemId: versionId,
      projectId: localProjectId,
    },
  });

  logger.info(`[${WORKER_NAME}] Created file record`, {
    fileId: newFile.id,
    fileName,
    projectId: localProjectId,
  });

  // Enqueue translation to SVF2
  try {
    await modelDerivativeService.translateToSVF2(urn);

    await prisma.file.update({
      where: { id: newFile.id },
      data: { status: "TRANSLATING" },
    });

    logger.info(`[${WORKER_NAME}] Enqueued SVF2 translation`, {
      fileId: newFile.id,
    });
  } catch (error) {
    logger.error(`[${WORKER_NAME}] Failed to enqueue translation`, {
      fileId: newFile.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Create notification
  await webhookProcessorService.createNotification(
    "VERSION_ADDED",
    localProjectId,
    newFile.id,
    { fileName, versionId: versionId.substring(0, 20) },
  );
}

// Event handlers
worker.on("completed", (job: Job) => {
  logger.debug(`[${WORKER_NAME}] Job completed`, { jobId: job.id });
});

worker.on("failed", (job: Job | undefined, error: Error) => {
  logger.error(`[${WORKER_NAME}] Job failed`, {
    jobId: job?.id,
    error: error.message,
    eventType: job?.data.eventType,
  });
});

worker.on("error", (error: Error) => {
  logger.error(`[${WORKER_NAME}] Worker error`, { error: error.message });
});

logger.info(`[${WORKER_NAME}] Worker started`, {
  concurrency: env.WEBHOOK_QUEUE_CONCURRENCY,
});

export default worker;
