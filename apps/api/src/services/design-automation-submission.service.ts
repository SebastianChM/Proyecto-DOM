import { env } from "../config/env";
import { logger } from "../lib/logger";
import { designAutomationService } from "./aps/design-automation.service";

export interface SubmitDesignAutomationWorkItemInput {
  conversionId: string;
  inputObjectKey: string;
  outputObjectKey: string;
  bucketKey: string;
  callbackUrl: string;
}

export class DesignAutomationSubmissionError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DesignAutomationSubmissionError";
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function getStatusCode(error: unknown): number | undefined {
  const maybe = error as { response?: { status?: number } };
  return maybe.response?.status;
}

function isRetryableSubmissionError(error: unknown): boolean {
  const status = getStatusCode(error);
  if (status !== undefined) {
    if ([429, 500, 502, 503, 504, 409].includes(status)) return true;
    if ([400, 401, 403, 404, 422].includes(status)) return false;
  }

  const maybe = error as { code?: string };
  if (maybe.code && ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "ENOTFOUND"].includes(maybe.code)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("not configured") ||
    message.includes("could not resolve") ||
    message.includes("invalid")
  ) {
    return false;
  }

  if (
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("temporarily") ||
    message.includes("socket hang up")
  ) {
    return true;
  }

  return true;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitDesignAutomationWorkItem(
  input: SubmitDesignAutomationWorkItemInput,
): Promise<{ workItemId: string; attemptsUsed: number }> {
  const maxAttempts = Math.max(1, env.CONVERSION_MAX_ATTEMPTS);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info("[CONVERSION_DA] Submitting work item", {
        conversionId: input.conversionId,
        attempt,
        maxAttempts,
      });

      const workItemId = await designAutomationService.convertRevitToPdf(
        input.inputObjectKey,
        input.outputObjectKey,
        input.bucketKey,
        input.callbackUrl,
      );

      if (!workItemId || typeof workItemId !== "string") {
        throw new DesignAutomationSubmissionError(
          "Design Automation returned an invalid work item id",
          false,
        );
      }

      logger.info("[CONVERSION_DA] Work item submitted", {
        conversionId: input.conversionId,
        attempt,
        workItemId: `${workItemId.substring(0, 30)}...`,
      });

      return { workItemId, attemptsUsed: attempt };
    } catch (error) {
      if (error instanceof DesignAutomationSubmissionError) {
        throw error;
      }

      const retryable = isRetryableSubmissionError(error);
      const statusCode = getStatusCode(error);
      const message = getErrorMessage(error);

      if (!retryable || attempt >= maxAttempts) {
        throw new DesignAutomationSubmissionError(
          message,
          retryable,
          statusCode,
        );
      }

      const delayMs = Math.min(
        env.CONVERSION_BACKOFF_DELAY * Math.pow(2, attempt - 1),
        30000,
      );

      logger.warn("[CONVERSION_DA] Submission failed, retrying", {
        conversionId: input.conversionId,
        attempt,
        maxAttempts,
        retryInMs: delayMs,
        statusCode,
        error: message.substring(0, 200),
      });

      await sleep(delayMs);
    }
  }

  throw new DesignAutomationSubmissionError(
    "Design Automation submission exhausted retries",
    false,
  );
}
