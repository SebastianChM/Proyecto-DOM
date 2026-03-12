import { Worker, Job } from "bullmq";
import { ConversionJobData } from "../lib/queue";
import prisma from "../lib/prisma";
import { env } from "../config/env";
import { CONSTANTS } from "../config/constants";
import { modelDerivativeService } from "../services/aps/model-derivative.service";
import {
  DesignAutomationSubmissionError,
  submitDesignAutomationWorkItem,
} from "../services/design-automation-submission.service";
import { resolveDesignAutomationCallbackUrl } from "../services/design-automation-callback.service";
import { logger } from "../lib/logger";

// Redis configuration (must match queue.ts)
const redisConfig = {
  host: env.REDIS_HOST || CONSTANTS.REDIS.DEFAULT_HOST,
  port: env.REDIS_PORT || CONSTANTS.REDIS.DEFAULT_PORT,
  password: env.REDIS_PASSWORD,
};

function resolveInputObjectKey(file: {
  apsUrn: string | null;
  s3Key: string | null;
}): string | null {
  if (file.s3Key && file.s3Key !== "IMPORTED_FROM_APS" && file.s3Key !== "unknown_key") {
    return file.s3Key;
  }

  if (!file.apsUrn) return null;

  try {
    const decodedUrn = Buffer.from(file.apsUrn, "base64").toString("utf-8");
    const match = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Error Classification Helper (Hito 5 Note 10)
 * Determines if an error is retryable based on status code/message
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof DesignAutomationSubmissionError) {
    return error.retryable;
  }

  const message =
    error instanceof Error ? error.message : String(error);

  // Retryable: Rate limiting (429)
  if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
    return true;
  }

  // Retryable: Server errors (5xx)
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return true;
  }

  // Non-retryable: Authentication/config/input failures
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.toLowerCase().includes("not configured") ||
    message.toLowerCase().includes("could not resolve") ||
    message.toLowerCase().includes("invalid")
  ) {
    return false;
  }

  // 409 Conflict: Usually retryable (job already in progress)
  if (message.includes("409")) {
    return true;
  }

  // Default: Retryable (be conservative)
  return true;
}

/**
 * Model Derivative Conversion Worker (Hito 5)
 * - Concurrency controlled by env.CONVERSION_MD_CONCURRENCY (default: 8)
 * - Implements idempotency via status checking (Hito 5 Note 9)
 * - Classifies errors for retry logic (Hito 5 Note 10)
 * - Sanitized logging (Hito 5 Note 12)
 */
const modelDerivativeWorker = new Worker<ConversionJobData>(
  "conversion-model-derivative",
  async (job: Job<ConversionJobData>) => {
    const { conversionId, batchId, userId, method, targetFormat } = job.data;
    const startTime = Date.now();

    // Sanitized log: NO tokens, NO headers (Hito 5 Note 12)
    logger.worker.start("CONVERSION_MD", job.id || "", {
      conversionId,
      batchId,
      userId,
      method,
      targetFormat,
      attempt: job.attemptsMade + 1,
    });

    // Fetch conversion with file data
    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
      include: { file: true },
    });

    if (!conversion) {
      logger.error("[CONVERSION_MD] Conversion not found", { conversionId });
      return { success: false, error: "Conversion not found" };
    }

    // CRITICAL: Idempotency check (Hito 5 Note 9)
    if (conversion.status === "COMPLETED") {
      logger.info("[CONVERSION_MD] Already COMPLETED, skipping", {
        conversionId,
      });
      return { success: true, alreadyCompleted: true };
    }

    if (conversion.status === "PROCESSING") {
      logger.warn("[CONVERSION_MD] Already PROCESSING by another worker", {
        conversionId,
      });
      throw new Error("Already being processed by another worker");
    }

    // Update status to PROCESSING
    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        attempts: job.attemptsMade + 1,
      },
    });

    try {
      // Execute translation based on target format
      logger.info("[CONVERSION_MD] Executing translation", {
        conversionId,
        format: targetFormat,
        urn: conversion.file.apsUrn?.substring(0, 20) + "...",
      });

      let result: { urn?: string };

      if (targetFormat === "IFC" || targetFormat === "ifc") {
        result = await modelDerivativeService.translateToIFC(
          conversion.file.apsUrn!,
        );
      } else if (targetFormat === "PDF" || targetFormat === "pdf") {
        result = await modelDerivativeService.translateToPDF(
          conversion.file.apsUrn!,
        );
      } else {
        throw new Error(`Unsupported format: ${targetFormat}`);
      }

      // Update to COMPLETED
      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          resultUrn: result.urn,
        },
      });

      const durationMs = Date.now() - startTime;
      logger.worker.complete("CONVERSION_MD", job.id || "", durationMs, {
        conversionId,
        batchId,
        attempt: job.attemptsMade + 1,
      });

      return { success: true, conversionId, durationMs };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Truncate error (Hito 5 Note 11: max 1000 chars)
      const truncatedError = errorMessage.substring(0, 1000);

      // Classify error for retry logic (Hito 5 Note 10)
      const retryable = isRetryableError(error);
      const attemptsLeft = env.CONVERSION_MAX_ATTEMPTS - (job.attemptsMade + 1);
      const finalStatus = retryable && attemptsLeft > 0 ? "QUEUED" : "FAILED";

      // Update status
      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: finalStatus,
          lastError: truncatedError,
          finishedAt: finalStatus === "FAILED" ? new Date() : undefined,
        },
      });

      // Sanitized error log (NO full stack, NO sensitive data)
      logger.worker.fail(
        "CONVERSION_MD",
        job.id || "",
        truncatedError.substring(0, 200),
        {
          conversionId,
          batchId,
          retryable,
          attempt: job.attemptsMade + 1,
          attemptsLeft,
        },
      );

      // If retryable, throw to trigger BullMQ retry
      if (retryable && attemptsLeft > 0) {
        throw error;
      }

      return { success: false, error: truncatedError };
    }
  },
  {
    connection: redisConfig,
    concurrency: env.CONVERSION_MD_CONCURRENCY, // Configurable concurrency (default: 8)
  },
);

/**
 * Design Automation Conversion Worker (Hito 5)
 * - Lower concurrency (default: 5) as DA is callback-dependent (Hito 5 Note 5)
 */
const designAutomationWorker = new Worker<ConversionJobData>(
  "conversion-design-automation",
  async (job: Job<ConversionJobData>) => {
    const { conversionId, batchId, userId } = job.data;
    const startTime = Date.now();

    logger.worker.start("CONVERSION_DA", job.id || "", {
      conversionId,
      batchId,
      userId,
      attempt: job.attemptsMade + 1,
    });

    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
      include: { file: true },
    });

    if (!conversion) {
      logger.error("[CONVERSION_DA] Conversion not found", { conversionId });
      return { success: false, error: "Conversion not found" };
    }

    // Idempotency check
    if (conversion.status === "COMPLETED") {
      logger.info("[CONVERSION_DA] Already COMPLETED, skipping", {
        conversionId,
      });
      return { success: true, alreadyCompleted: true };
    }

    if (conversion.status === "PROCESSING") {
      logger.warn("[CONVERSION_DA] Already PROCESSING", { conversionId });
      throw new Error("Already being processed by another worker");
    }

    // Update to PROCESSING
    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        attempts: job.attemptsMade + 1,
      },
    });

    try {
      const callbackUrl = resolveDesignAutomationCallbackUrl();
      if (!callbackUrl) {
        throw new Error("Design Automation callback URL is not configured");
      }

      const inputObjectKey = resolveInputObjectKey({
        apsUrn: conversion.file.apsUrn,
        s3Key: conversion.file.s3Key || null,
      });

      if (!inputObjectKey) {
        throw new Error("Could not resolve input object key for Design Automation");
      }

      if (!env.APS_BUCKET) {
        throw new Error("APS_BUCKET is not configured");
      }

      const outputObjectKey = `conversions/${conversionId}/output.pdf`;

      logger.info("[CONVERSION_DA] Submitting DA work item", {
        conversionId,
        callbackPath: "/api/callbacks/design-automation/callback",
        inputObjectKey: inputObjectKey.substring(0, 80),
      });

      const { workItemId, attemptsUsed } = await submitDesignAutomationWorkItem({
        conversionId,
        inputObjectKey,
        outputObjectKey,
        bucketKey: env.APS_BUCKET,
        callbackUrl,
      });

      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          workItemId,
          resultUrn: `oss:${env.APS_BUCKET}/${outputObjectKey}`,
          status: "PROCESSING",
          lastError: null,
          error: null,
          dedupeKey: null,
          finishedAt: null,
          completedAt: null,
        },
      });

      const durationMs = Date.now() - startTime;
      logger.worker.complete("CONVERSION_DA", job.id || "", durationMs, {
        conversionId,
        workItemId: workItemId.substring(0, 30) + "...",
        status: "awaiting_callback",
        submitAttempts: attemptsUsed,
      });

      return { success: true, conversionId, workItemId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const truncatedError = errorMessage.substring(0, 1000);
      const retryable = isRetryableError(error);
      const attemptsLeft = env.CONVERSION_MAX_ATTEMPTS - (job.attemptsMade + 1);
      const finalStatus = retryable && attemptsLeft > 0 ? "QUEUED" : "FAILED";

      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: finalStatus,
          lastError: truncatedError,
          error: truncatedError.substring(0, 500),
          workItemId: null,
          dedupeKey: null,
          startedAt: finalStatus === "QUEUED" ? null : undefined,
          finishedAt: finalStatus === "FAILED" ? new Date() : null,
          completedAt: finalStatus === "FAILED" ? new Date() : null,
        },
      });

      logger.error(`[CONVERSION_DA_WORKER] Failed`, {
        conversionId,
        error: truncatedError.substring(0, 200),
        retryable,
        attempt: job.attemptsMade + 1,
      });

      if (retryable && attemptsLeft > 0) {
        throw error;
      }

      return { success: false, error: truncatedError };
    }
  },
  {
    connection: redisConfig,
    concurrency: env.CONVERSION_DA_CONCURRENCY, // Lower concurrency (default: 5) for callback-dependent work
  },
);

// Event listeners for monitoring
[modelDerivativeWorker, designAutomationWorker].forEach((worker) => {
  worker.on("completed", (job) => {
    logger.debug(`[WORKER] Job completed`, {
      queue: worker.name,
      jobId: job.id,
    });
  });

  worker.on("failed", (job, err) => {
    if (job) {
      logger.error(`[WORKER] Job failed`, {
        queue: worker.name,
        jobId: job.id,
        error: err.message.substring(0, 200),
      });
    }
  });

  worker.on("error", (err) => {
    logger.error(`[WORKER] Worker error`, {
      queue: worker.name,
      error: err.message,
    });
  });
});

logger.info("[HITO 5] BullMQ-based conversion workers initialized", {
  mdConcurrency: env.CONVERSION_MD_CONCURRENCY,
  daConcurrency: env.CONVERSION_DA_CONCURRENCY,
});

export default {
  modelDerivativeWorker,
  designAutomationWorker,
};

