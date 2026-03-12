import { Worker, Job } from "bullmq";
import { DesignAutomationCallbackJobData } from "../lib/queue";
import { env } from "../config/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../lib/logger";
import { processDesignAutomationCallbackJob } from "../services/design-automation-callback.service";

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

    const result = await processDesignAutomationCallbackJob(job.data);

    const durationMs = Date.now() - startTime;
    logger.worker.complete("DA_CALLBACK", job.id || "", durationMs, {
      conversionId: job.data.conversionId,
      status: result.status,
      success: result.success,
    });

    return result;
  },
  {
    connection: redisConfig,
    concurrency: Math.max(1, Math.min(env.CONVERSION_DA_CONCURRENCY, 10)),
  },
);

worker.on("failed", (job, error) => {
  logger.error("[DA_CALLBACK_WORKER] Job failed", {
    jobId: job?.id,
    conversionId: job?.data?.conversionId,
    workItemId: job?.data?.workItemId,
    error: error.message.substring(0, 200),
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
