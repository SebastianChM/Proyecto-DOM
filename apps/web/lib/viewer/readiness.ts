const ACTIVE_FILE_STATUSES = new Set([
  "UPLOADING",
  "UPLOADED",
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "TRANSLATING",
]);

export const normalizeFileStatus = (status: string | null | undefined): string => {
  return String(status ?? "UNKNOWN").trim().toUpperCase();
};

export const isViewerReady = (
  status: string | null | undefined,
  apsUrn: string | null | undefined,
): boolean => {
  return normalizeFileStatus(status) === "READY" && !!apsUrn;
};

export const isFileLifecycleActive = (status: string | null | undefined): boolean => {
  return ACTIVE_FILE_STATUSES.has(normalizeFileStatus(status));
};

export const getViewerReadinessMessage = (
  status: string | null | undefined,
): string => {
  const normalized = normalizeFileStatus(status);

  if (normalized === "UPLOADING") {
    return "File upload is in progress. Viewer will unlock once upload and translation finish.";
  }

  if (normalized === "UPLOADED" || normalized === "QUEUED" || normalized === "PENDING") {
    return "File is queued for translation. This page refreshes automatically until it is ready.";
  }

  if (normalized === "PROCESSING" || normalized === "TRANSLATING") {
    return "File is being translated for viewer usage. This usually takes a few minutes.";
  }

  if (normalized === "LOCAL_ONLY") {
    return "File is available only in local fallback mode and may not be viewable in Autodesk Viewer.";
  }

  if (normalized === "FAILED") {
    return "Processing failed. Retry translation from the project file actions.";
  }

  return "File is not ready for viewer access yet.";
};
