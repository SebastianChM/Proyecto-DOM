import { Worker, Job } from "bullmq";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { CONSTANTS } from "../config/constants";
import { createValidationNotifications } from "../services/validation/notification.service";
import { detectAndNotifyChanges } from "../services/validation/change-detection.service";

// Redis configuration
const redisConfig = {
  host: env.REDIS_HOST || CONSTANTS.REDIS.DEFAULT_HOST,
  port: env.REDIS_PORT || CONSTANTS.REDIS.DEFAULT_PORT,
  password: env.REDIS_PASSWORD,
};

// Types
interface ValidationElement {
  tag: string;
  type?: string;
  [key: string]: unknown;
}

export interface ValidationJobPayload {
  validationRunId: string;
  fileId: string;
  projectId?: string;
  userId: string;
  etData: ValidationElement[];
  modelData: ValidationElement[];
}

interface IssueData {
  type: "MISSING" | "MISMATCH" | "UNDOCUMENTED";
  severity: "HIGH" | "MEDIUM" | "LOW";
  elementTag: string;
  elementType: string;
  message: string;
  description: string;
  expectedValue?: string;
  actualValue?: string;
}

/**
 * Validation Worker (Hito 5)
 * - Processes validation runs in background
 * - Handles notifications and change detection
 */
const validationWorker = new Worker<ValidationJobPayload>(
  "validation",
  async (job: Job<ValidationJobPayload>) => {
    const { validationRunId, fileId, projectId, userId, etData, modelData } =
      job.data;
    const startTime = Date.now();

    logger.worker.start("VALIDATION", job.id || "", {
      validationRunId,
      fileId,
      attempt: job.attemptsMade + 1,
    });

    try {
      // 1. Update status to PROCESSING
      const validationRun = await prisma.validationRun.update({
        where: { id: validationRunId },
        data: { status: "PROCESSING" },
        select: { fileName: true, id: true },
      });

      logger.info("[VALIDATION] Processing validation", {
        fileName: validationRun.fileName,
      });

      // 2. Execute Validation Logic
      const issuesData: IssueData[] = [];
      const isDemoMode = env.DEMO_MODE;

      if (etData?.length > 0 && modelData?.length > 0) {
        const etTags = new Set(etData.map((item) => item.tag));
        const modelTags = new Set(modelData.map((item) => item.tag));

        // Missing Elements (In ET, not in Model)
        for (const item of etData) {
          if (!modelTags.has(item.tag)) {
            issuesData.push({
              type: "MISSING",
              severity: "HIGH",
              elementTag: item.tag,
              elementType: item.type || "Unknown",
              message: `Element ${item.tag} is in the engineering table but missing in the 3D model`,
              description: `Expected element with tag "${item.tag}" was not found in the model`,
            });
          }
        }

        // Undocumented Elements (In Model, not in ET)
        for (const item of modelData) {
          if (!etTags.has(item.tag)) {
            issuesData.push({
              type: "UNDOCUMENTED",
              severity: "MEDIUM",
              elementTag: item.tag,
              elementType: item.type || "Unknown",
              message: `Element ${item.tag} exists in the model but is not documented in the engineering table`,
              description: `Found undocumented element "${item.tag}" in the model`,
            });
          }
        }

        // Property Mismatches
        for (const etItem of etData) {
          const modelItem = modelData.find((m) => m.tag === etItem.tag);
          if (
            modelItem &&
            etItem.type &&
            modelItem.type &&
            etItem.type !== modelItem.type
          ) {
            issuesData.push({
              type: "MISMATCH",
              severity: "MEDIUM",
              elementTag: etItem.tag,
              elementType: etItem.type,
              message: `Type mismatch for ${etItem.tag}: ET shows "${etItem.type}", model shows "${modelItem.type}"`,
              description: `Property mismatch detected`,
              expectedValue: etItem.type,
              actualValue: modelItem.type,
            });
          }
        }
      } else if (isDemoMode) {
        logger.info("[VALIDATION] Demo mode active - generating sample issues");
        issuesData.push({
          type: "MISSING",
          severity: "HIGH",
          elementTag: "DEMO-101",
          elementType: "Wall",
          message: "Demo Issue: Wall missing in model",
          description: "This is a simulated issue for demo purposes.",
        });
        issuesData.push({
          type: "MISMATCH",
          severity: "MEDIUM",
          elementTag: "DEMO-102",
          elementType: "Door",
          message: "Demo Issue: Type mismatch for Door",
          description: "Property mismatch detected in demo mode.",
          expectedValue: "Wood",
          actualValue: "Steel",
        });
      }

      // 3. Save Issues
      if (issuesData.length > 0) {
        await prisma.validationIssue.createMany({
          data: issuesData.map((issue) => ({
            validationRunId: validationRun.id,
            type: issue.type,
            severity: issue.severity,
            status: "OPEN",
            elementTag: issue.elementTag,
            elementType: issue.elementType,
            message: issue.message,
            description: issue.description,
            expectedValue: issue.expectedValue || null,
            actualValue: issue.actualValue || null,
          })),
        });
      }

      // 4. Calculate Stats
      const missingCount = issuesData.filter(
        (i) => i.type === "MISSING",
      ).length;
      const mismatchCount = issuesData.filter(
        (i) => i.type === "MISMATCH",
      ).length;
      const undocumentedCount = issuesData.filter(
        (i) => i.type === "UNDOCUMENTED",
      ).length;
      const totalElements = (etData?.length || 0) + (modelData?.length || 0);

      // 5. Update Run Status to COMPLETED
      await prisma.validationRun.update({
        where: { id: validationRun.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          totalElements,
          missingCount,
          mismatchCount,
          undocumentedCount,
        },
      });

      // 6. Notifications
      await createValidationNotifications(
        validationRun.id,
        userId,
        fileId,
        projectId || null,
      );

      // 7. Change Detection
      await detectAndNotifyChanges(
        fileId,
        validationRun.id,
        userId,
        projectId || null,
      );

      const durationMs = Date.now() - startTime;
      logger.worker.complete("VALIDATION", job.id || "", durationMs, {
        validationRunId,
        issueCount: issuesData.length,
      });

      return { success: true, durationMs };
    } catch (error: unknown) {
      const err = error as Error;
      logger.worker.fail("VALIDATION", job.id || "", err.message);

      await prisma.validationRun.update({
        where: { id: validationRunId },
        data: { status: "FAILED" },
      });

      throw error;
    }
  },
  {
    connection: redisConfig,
    prefix: "dom-bim",
    concurrency: 5, // Default concurrency
  },
);

// Monitoring listeners
validationWorker.on("completed", (job) => {
  logger.debug("[VALIDATION] Job completed", { jobId: job.id });
});

validationWorker.on("failed", (job, err) => {
  logger.error("[VALIDATION] Job failed", {
    jobId: job?.id,
    error: err.message,
  });
});

export default validationWorker;
