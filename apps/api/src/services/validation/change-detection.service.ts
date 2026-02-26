import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";

/**
 * Automatic change detection service
 * Compares latest validation with previous one for the same file
 */
export async function detectAndNotifyChanges(
  fileId: string,
  latestValidationId: string,
  userId: string,
  projectId: string | null,
) {
  try {
    // Get the two most recent validations for this file
    const recentValidations = await prisma.validationRun.findMany({
      where: { fileId },
      orderBy: { createdAt: "desc" },
      take: 2,
      include: {
        issues: true,
      },
    });

    if (recentValidations.length < 2) {
      logger.debug("[CHANGE_DETECTION] No previous validation to compare with");
      return;
    }

    const [latest, previous] = recentValidations;

    // Compare issue counts
    const changesDetected: string[] = [];

    if (latest.missingCount !== previous.missingCount) {
      const diff = latest.missingCount - previous.missingCount;
      changesDetected.push(
        `Missing elements changed: ${diff > 0 ? "+" : ""}${diff}`,
      );
    }

    if (latest.mismatchCount !== previous.mismatchCount) {
      const diff = latest.mismatchCount - previous.mismatchCount;
      changesDetected.push(`Mismatches changed: ${diff > 0 ? "+" : ""}${diff}`);
    }

    if (latest.undocumentedCount !== previous.undocumentedCount) {
      const diff = latest.undocumentedCount - previous.undocumentedCount;
      changesDetected.push(
        `Undocumented changed: ${diff > 0 ? "+" : ""}${diff}`,
      );
    }

    // Map issues by element tag for detailed comparison
    const latestIssuesMap = new Map(
      latest.issues.filter((i) => i.elementTag).map((i) => [i.elementTag!, i]),
    );

    const previousIssuesMap = new Map(
      previous.issues
        .filter((i) => i.elementTag)
        .map((i) => [i.elementTag!, i]),
    );

    // Find new issues
    const newIssues = latest.issues.filter(
      (i) => i.elementTag && !previousIssuesMap.has(i.elementTag),
    );

    // Find resolved issues
    const resolvedIssues = previous.issues.filter(
      (i) => i.elementTag && !latestIssuesMap.has(i.elementTag),
    );

    // If significant changes detected, create a FILE_CHANGED notification
    if (
      changesDetected.length > 0 ||
      newIssues.length > 0 ||
      resolvedIssues.length > 0
    ) {
      const totalChange = newIssues.length - resolvedIssues.length;

      await prisma.notification.create({
        data: {
          userId,
          type: "FILE_CHANGED",
          title: "File Updated - Changes Detected",
          message: `Changes detected in "${latest.fileName}": ${newIssues.length} new issues, ${resolvedIssues.length} resolved issues. ${changesDetected.join(", ")}`,
          validationRunId: latest.id,
          fileId,
          projectId,
          priority: Math.abs(totalChange) > 5 ? "HIGH" : "NORMAL",
          metadata: JSON.stringify({
            newIssues: newIssues.map((i) => ({
              tag: i.elementTag,
              type: i.type,
            })),
            resolvedIssues: resolvedIssues.map((i) => ({
              tag: i.elementTag,
              type: i.type,
            })),
            changes: changesDetected,
            previousValidationId: previous.id,
            latestValidationId: latest.id,
          }),
        },
      });

      logger.info(
        `[CHANGE_DETECTION] ${changesDetected.length} changes, ${newIssues.length} new, ${resolvedIssues.length} resolved`,
      );
    }
  } catch (error) {
    logger.error("[CHANGE_DETECTION] Error in change detection", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
