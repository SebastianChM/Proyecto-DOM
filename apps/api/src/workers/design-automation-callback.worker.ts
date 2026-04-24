import { Worker, Job } from "bullmq";
import { DesignAutomationCallbackJobData } from "../lib/queue";
import { env } from "../config/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../lib/logger";
import prisma from "../lib/prisma";
import {
  DesignAutomationCallbackProcessingError,
  processDesignAutomationCallbackJob,
} from "../services/design-automation-callback.service";

const redisConfig = {
  host: env.REDIS_HOST || CONSTANTS.REDIS.DEFAULT_HOST,
  port: env.REDIS_PORT || CONSTANTS.REDIS.DEFAULT_PORT,
  password: env.REDIS_PASSWORD,
};

const worker = new Worker<DesignAutomationCallbackJobData>(
  "design-automation-callback",
  async (job: Job<DesignAutomationCallbackJobData>) => {
    const startTime = Date.now();

    logger.worker.start("DA_CALLBACK", job.id || "", {
      conversionId: job.data.conversionId,
      workItemId: job.data.workItemId,
      status: job.data.status,
      attempt: job.attemptsMade + 1,
    });

    try {
      const result = await processDesignAutomationCallbackJob(job.data);

      const durationMs = Date.now() - startTime;
      logger.worker.complete("DA_CALLBACK", job.id || "", durationMs, {
        conversionId: job.data.conversionId,
        status: result.status,
        success: result.success,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const retryable =
        error instanceof DesignAutomationCallbackProcessingError
          ? error.retryable
          : true;

      logger.worker.fail("DA_CALLBACK", job.id || "", errorMessage, {
        conversionId: job.data.conversionId,
        workItemId: job.data.workItemId,
        attempt: job.attemptsMade + 1,
        retryable,
      });

      if (!retryable) {
        return {
          success: false,
          status: "FAILED",
          error: errorMessage.substring(0, 200),
        };
      }

      throw error;
    }
  },
  {
    connection: redisConfig,
    prefix: "dom-bim",
    concurrency: Math.max(1, Math.min(env.CONVERSION_DA_CONCURRENCY, 10)),
  },
);

worker.on("failed", async (job, error) => {
  logger.error("[DA_CALLBACK_WORKER] Job failed", {
    jobId: job?.id,
    conversionId: job?.data?.conversionId,
    workItemId: job?.data?.workItemId,
    error: error.message.substring(0, 200),
    attempt: job?.attemptsMade,
  });

  if (!job) return;

  const configuredAttempts =
    typeof job.opts.attempts === "number"
      ? job.opts.attempts
      : env.CONVERSION_MAX_ATTEMPTS;

  if (job.attemptsMade < configuredAttempts) {
    return;
  }

  const finalError = `DA callback exhausted retries: ${error.message.substring(0, 300)}`;

  await prisma.conversion.updateMany({
    where: {
      id: job.data.conversionId,
      status: {
        in: ["PENDING", "QUEUED", "PROCESSING"],
      },
    },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      completedAt: new Date(),
      lastError: finalError,
      error: finalError,
    },
  });

  logger.error("[DA_CALLBACK_WORKER] Conversion marked FAILED after retry exhaustion", {
    conversionId: job.data.conversionId,
    attempts: job.attemptsMade,
  });
});

worker.on("error", (error) => {
  logger.error("[DA_CALLBACK_WORKER] Worker error", {
    error: error.message,
  });
});

logger.info("[DA_CALLBACK_WORKER] Started", {
  concurrency: Math.max(1, Math.min(env.CONVERSION_DA_CONCURRENCY, 10)),
});

export default worker;
