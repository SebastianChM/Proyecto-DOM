import { env } from "./config/env";
import prisma from "./lib/prisma";
import { redis } from "./lib/redis";
import { Queues } from "./lib/queue";
import { logger } from "./lib/logger";

logger.info(
  `[WORKER] DOM BIM Platform - Dedicated Worker Process [${env.NODE_ENV}]`,
);

const startWorker = async () => {
  try {
    // 1. Connect to Infrastructure
    await prisma.$connect();
    logger.info("[WORKER] Database connected");

    await redis.ping();
    logger.info("[WORKER] Redis connected");

    // 2. Load Workers (Side-effect imports start the processors)
    logger.info("[WORKER] Loading processors...");

    // Hito 5: Unified Workers
    import("./workers/conversion.worker");
    import("./workers/webhook-worker");
    import("./workers/design-automation-callback.worker");
    import("./workers/validation.worker");

    logger.info("[WORKER] All systems operational");
  } catch (error) {
    logger.error("[WORKER] Failed to start", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
};

startWorker();

// Graceful Shutdown
const shutdown = async () => {
  logger.info("[WORKER] Shutting down...");

  // Close queues to stop accepting new jobs
  await Queues.validation.close();
  await Queues.conversion.close();
  await Queues.conversionMd.close();
  await Queues.conversionDa.close();
  await Queues.designAutomationCallback.close();
  await Queues.apsWebhooks.close();
  await Queues.comparison.close();

  // Workers invoked via side-effects maintain their own connections via BullMQ
  // They will close eventually or when process exits

  await prisma.$disconnect();
  try {
    await redis.quit();
  } catch (e) {
    logger.error("[WORKER] Redis close error", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
