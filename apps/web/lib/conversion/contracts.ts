import type { BatchConversionStatusResponse } from "@/lib/api/types";

export type TrackerStatus = "pending" | "processing" | "completed" | "failed";

export interface NormalizedBatchSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface NormalizedBatchStatus {
  status: "pending" | "processing" | "completed" | "failed";
  summary: NormalizedBatchSummary;
}

export const FALLBACK_SUPPORTED_FORMATS: Record<string, string[]> = {
  dwg: ["pdf"],
  dxf: ["pdf"],
  rvt: ["ifc", "pdf"],
  nwc: ["ifc"],
  nwd: ["ifc"],
  ifc: ["ifc"],
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const asCount = (value: unknown): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, value);
};

const normalizeStatus = (status: unknown): string => {
  return String(status ?? "").trim().toUpperCase();
};

const canonicalBatchStatus = (
  status: string,
): "pending" | "processing" | "completed" | "failed" => {
  if (status === "FAILED") return "failed";
  if (status === "COMPLETED" || status === "SUCCESS") return "completed";
  if (
    status === "PROCESSING" ||
    status === "RUNNING" ||
    status === "IN_PROGRESS"
  ) {
    return "processing";
  }
  return "pending";
};

export const normalizeSupportedFormats = (
  payload: unknown,
): Record<string, string[]> => {
  const source =
    isRecord(payload) && isRecord(payload.formats) ? payload.formats : payload;

  if (!isRecord(source)) return {};

  const normalized: Record<string, string[]> = {};

  for (const [rawExt, rawTargets] of Object.entries(source)) {
    const ext = rawExt.trim().toLowerCase();
    if (!ext || !Array.isArray(rawTargets)) continue;

    const targets = Array.from(
      new Set(
        rawTargets
          .map((target) => String(target).trim().toLowerCase())
          .filter((target) => target.length > 0),
      ),
    ).sort();

    if (targets.length > 0) {
      normalized[ext] = targets;
    }
  }

  return normalized;
};

export const isConversionSupportedByFormats = (
  formats: Record<string, string[]> | null,
  fileType: string,
  targetFormat: string,
): boolean => {
  if (!formats) return false;
  const ext = fileType.trim().toLowerCase();
  const target = targetFormat.trim().toLowerCase();

  return (formats[ext] ?? []).includes(target);
};

export const normalizeTrackerStatus = (status: unknown): TrackerStatus => {
  const normalized = normalizeStatus(status);

  if (normalized === "FAILED" || normalized === "ERROR") return "failed";
  if (normalized === "COMPLETED" || normalized === "SUCCESS") return "completed";
  if (
    normalized === "PROCESSING" ||
    normalized === "RUNNING" ||
    normalized === "TRANSLATING" ||
    normalized === "UPLOADING"
  ) {
    return "processing";
  }
  if (
    normalized === "QUEUED" ||
    normalized === "PENDING" ||
    normalized === "CREATED"
  ) {
    return "pending";
  }

  return "pending";
};

export const normalizeBatchStatus = (
  payload: BatchConversionStatusResponse | unknown,
): NormalizedBatchStatus => {
  const raw = isRecord(payload) ? payload : {};

  const summarySource = isRecord(raw.summary)
    ? raw.summary
    : isRecord(raw.counts)
      ? raw.counts
      : {};

  const pending =
    asCount(summarySource.pending) + asCount(summarySource.queued);
  const processing = asCount(summarySource.processing);
  const completed = asCount(summarySource.completed);
  const failed = asCount(summarySource.failed);

  const summary: NormalizedBatchSummary = {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  };

  const explicitStatus = canonicalBatchStatus(normalizeStatus(raw.status));
  if (explicitStatus !== "pending") {
    return { status: explicitStatus, summary };
  }

  if (summary.total === 0) {
    return { status: "pending", summary };
  }

  if (summary.processing > 0 || summary.pending > 0) {
    return { status: "processing", summary };
  }

  if (summary.completed > 0) {
    return { status: "completed", summary };
  }

  return { status: "failed", summary };
};
