import prisma from "../lib/prisma";
import { Queues } from "../lib/queue";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { apsOssService } from "./aps/oss.service";
import { designAutomationService } from "./aps/design-automation.service";

export interface DesignAutomationCallbackPayload {
  workItemId: string;
  status: string;
  reportUrl?: string;
}

export class DesignAutomationCallbackError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DesignAutomationCallbackError";
  }
}

export class DesignAutomationCallbackProcessingError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DesignAutomationCallbackProcessingError";
  }
}

const DA_CALLBACK_PATH = "/api/callbacks/design-automation/callback";

function parseResultUrn(resultUrn: string | null): { bucket: string; objectKey: string } | null {
  if (!resultUrn || !resultUrn.startsWith("oss:")) {
    return null;
  }

  const raw = resultUrn.slice(4);
  const slashIndex = raw.indexOf("/");
  if (slashIndex <= 0 || slashIndex >= raw.length - 1) {
    return null;
  }

  return {
    bucket: raw.slice(0, slashIndex),
    objectKey: raw.slice(slashIndex + 1),
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getErrorStatus(error: unknown): number | undefined {
  const maybe = error as { response?: { status?: number }; statusCode?: number };
  return maybe.response?.status ?? maybe.statusCode;
}

async function ensureOutputArtifactReady(conversion: {
  id: string;
  resultUrn: string | null;
}) {
  const parsed = parseResultUrn(conversion.resultUrn);
  if (!parsed) {
    return null;
  }

  if (parsed.bucket !== env.APS_BUCKET) {
    logger.warn("[DA_CALLBACK_WORKER] Result bucket differs from configured APS bucket", {
      conversionId: conversion.id,
      resultBucket: parsed.bucket,
      configuredBucket: env.APS_BUCKET,
    });
  }

  try {
    const objectDetails = await apsOssService.getObjectDetails(parsed.objectKey);
    return {
      bucket: parsed.bucket,
      objectKey: parsed.objectKey,
      size: (objectDetails as { size?: number })?.size,
    };
  } catch (error) {
    const status = getErrorStatus(error);
    const retryable =
      status === undefined ||
      status === 404 ||
      status === 409 ||
      status === 429 ||
      status >= 500;

    throw new DesignAutomationCallbackProcessingError(
      `Output artifact not ready for conversion ${conversion.id}`,
      retryable,
    );
  }
}

async function resolveReportUrlFromWorkItem(workItemId: string): Promise<string | undefined> {
  try {
    const payload = (await designAutomationService.getWorkItemStatusRest(workItemId)) as {
      reportUrl?: string;
      statusDetails?: { reportUrl?: string };
    };

    return payload.reportUrl || payload.statusDetails?.reportUrl;
  } catch (error) {
    logger.warn("[DA_CALLBACK_WORKER] Could not fetch DA work item status", {
      workItemId: `${workItemId.substring(0, 30)}...`,
      error: getErrorMessage(error).substring(0, 200),
    });
    return undefined;
  }
}

export function resolveDesignAutomationCallbackUrl(): string | null {
  const candidates = [env.APS_WEBHOOK_URL, env.APS_CALLBACK_URL].filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      return `${parsed.origin}${DA_CALLBACK_PATH}`;
    } catch {
      // Ignore invalid URL candidates and continue.
    }
  }

  return null;
}

export function normalizeDesignAutomationCallbackPayload(
  rawPayload: Record<string, unknown>,
): DesignAutomationCallbackPayload {
  const workItemId = String(rawPayload.workItemId ?? rawPayload.id ?? "").trim();
  const status = String(rawPayload.status ?? "").trim();
  const reportUrl = rawPayload.reportUrl
    ? String(rawPayload.reportUrl)
    : undefined;

  if (!workItemId || !status) {
    throw new DesignAutomationCallbackError(
      "Invalid payload: workItemId and status required",
      400,
      "INVALID_PAYLOAD",
    );
  }

  return { workItemId, status, reportUrl };
}

export async function enqueueDesignAutomationCallback(
  callback: DesignAutomationCallbackPayload,
  requestMeta: Record<string, unknown>,
): Promise<{
  conversionId: string;
  duplicate: boolean;
  dedupeKey: string;
}> {
  const normalizedStatus = callback.status.toLowerCase();

  // CRITICAL: Exact match ONLY (no substring search)
  const conversion = await prisma.conversion.findFirst({
    where: { workItemId: callback.workItemId },
  });

  if (!conversion) {
    throw new DesignAutomationCallbackError(
      "Conversion not found for workItemId",
      404,
      "CONVERSION_NOT_FOUND",
    );
  }

  const dedupeKey = `DA:${callback.workItemId}:${normalizedStatus}`;

  const existingDelivery = await prisma.conversion.findFirst({
    where: { dedupeKey },
  });

  if (existingDelivery) {
    logger.debug("[DA_CALLBACK] Duplicate callback detected", {
      ...requestMeta,
      conversionId: existingDelivery.id,
      dedupeKey,
    });

    return {
      conversionId: existingDelivery.id,
      duplicate: true,
      dedupeKey,
    };
  }

  await prisma.conversion.update({
    where: { id: conversion.id },
    data: { dedupeKey },
  });

  try {
    await Queues.designAutomationCallback.add("process-da-callback", {
      conversionId: conversion.id,
      workItemId: callback.workItemId,
      status: normalizedStatus,
      reportUrl: callback.reportUrl,
    });
  } catch {
    await prisma.conversion.updateMany({
      where: { id: conversion.id, dedupeKey },
      data: { dedupeKey: null },
    });

    throw new DesignAutomationCallbackError(
      "Failed to enqueue callback",
      503,
      "QUEUE_UNAVAILABLE",
    );
  }

  return {
    conversionId: conversion.id,
    duplicate: false,
    dedupeKey,
  };
}

export async function processDesignAutomationCallbackJob(data: {
  conversionId: string;
  workItemId: string;
  status: string;
  reportUrl?: string;
}) {
  const { conversionId, status, reportUrl, workItemId } = data;
  const normalizedStatus = status.toLowerCase();

  const conversion = await prisma.conversion.findUnique({
    where: { id: conversionId },
    select: {
      id: true,
      workItemId: true,
      resultUrn: true,
      resultUrl: true,
      status: true,
    },
  });

  if (!conversion) {
    logger.error("[DA_CALLBACK_WORKER] Conversion not found", {
      conversionId,
      workItemId,
    });
    return { success: false, error: "Conversion not found", status: "FAILED" };
  }

  if (!conversion.workItemId || conversion.workItemId !== workItemId) {
    logger.warn("[DA_CALLBACK_WORKER] Ignoring callback with mismatched workItemId", {
      conversionId,
      callbackWorkItemId: `${workItemId.substring(0, 30)}...`,
      persistedWorkItemId: conversion.workItemId
        ? `${conversion.workItemId.substring(0, 30)}...`
        : null,
    });

    return { success: false, status: "IGNORED" };
  }

  if (normalizedStatus === "completed" || normalizedStatus === "success") {
    const artifact = await ensureOutputArtifactReady(conversion);
    const reportUrlFromWorkItem = reportUrl
      ? undefined
      : await resolveReportUrlFromWorkItem(workItemId);

    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        completedAt: new Date(),
        resultUrl: reportUrl || reportUrlFromWorkItem || conversion.resultUrl,
        lastError: null,
        error: null,
      },
    });

    logger.info("[DA_CALLBACK_WORKER] Conversion completed", {
      conversionId,
      workItemId,
      artifactReady: !!artifact,
      outputObjectKey: artifact?.objectKey,
      hasReportUrl: !!(reportUrl || reportUrlFromWorkItem),
    });

    return { success: true, status: "COMPLETED" };
  }

  if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
    const finalError = `DA work item ${normalizedStatus}`;

    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        completedAt: new Date(),
        lastError: finalError,
        error: finalError,
      },
    });

    logger.warn("[DA_CALLBACK_WORKER] Conversion failed", {
      conversionId,
      workItemId,
      status: normalizedStatus,
    });

    return { success: false, status: "FAILED" };
  }

  if (normalizedStatus === "inprogress" || normalizedStatus === "running" || normalizedStatus === "pending") {
    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: "PROCESSING",
        lastError: null,
      },
    });
  }

  logger.debug("[DA_CALLBACK_WORKER] Non-terminal callback status", {
    conversionId,
    workItemId,
    status: normalizedStatus,
  });

  return { success: true, status: "PROCESSING" };
}

