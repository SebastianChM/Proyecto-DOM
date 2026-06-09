import { useState, useEffect } from "react";
import { pollWithBackoff } from "@/hooks/usePollingWithBackoff";
import { toast } from "sonner";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import type { ActiveConversion } from "@/components/ConversionTracker";
import type {
  BatchConversionStatusResponse,
  ConversionStatusResponse,
  ProjectFileDetail,
} from "@/lib/api/types";
import { conversionService } from "@/lib/api/services";
import {
  FALLBACK_SUPPORTED_FORMATS,
  isConversionSupportedByFormats,
  normalizeBatchStatus,
  normalizeSupportedFormats,
  normalizeTrackerStatus,
} from "@/lib/conversion/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DownloadModal {
  isOpen: boolean;
  url: string;
  format: string;
  conversionId?: string;
}

interface UseConversionsDeps {
  project: { files: ProjectFileDetail[] } | null;
  selectedFiles: string[];
  /** Called with an empty array after a bulk conversion is initiated — clears the selection. */
  onClearSelection: () => void;
  /** Called after a conversion or save-to-project completes to trigger a project refresh. */
  onConversionComplete: () => void;
  userRole?: string;
}

export interface UseConversionsReturn {
  supportedFormats: Record<string, string[]> | null;
  isConversionSupported: (fileType: string, targetFormat: string) => boolean;
  areFilesCompatible: (fileIds: string[], format: string) => boolean;
  convertingFiles: Set<string>;
  handleConvert: (fileId: string, format: "pdf" | "ifc") => Promise<void>;
  handleBulkConvert: (format: "pdf" | "ifc") => Promise<void>;
  activeConversions: ActiveConversion[];
  setActiveConversions: React.Dispatch<
    React.SetStateAction<ActiveConversion[]>
  >;
  downloadModal: DownloadModal | null;
  setDownloadModal: React.Dispatch<React.SetStateAction<DownloadModal | null>>;
  handleSaveToProject: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal helpers (reduce repetitive set-state boilerplate)
// ---------------------------------------------------------------------------

const addConverting = (
  setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ids: string | string[],
) => {
  const arr = Array.isArray(ids) ? ids : [ids];
  setter((prev) => {
    const next = new Set(prev);
    arr.forEach((id) => next.add(id));
    return next;
  });
};

const removeConverting = (
  setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ids: string | string[],
) => {
  const arr = Array.isArray(ids) ? ids : [ids];
  setter((prev) => {
    const next = new Set(prev);
    arr.forEach((id) => next.delete(id));
    return next;
  });
};

const patchConversion = (
  setter: React.Dispatch<React.SetStateAction<ActiveConversion[]>>,
  trackingId: string,
  patch: Partial<ActiveConversion>,
) => {
  setter((prev) =>
    prev.map((conversion) =>
      conversion.id === trackingId ? { ...conversion, ...patch } : conversion,
    ),
  );
};

const getBatchDownloadUrl = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as {
    downloadUrl?: unknown;
    zipUrl?: unknown;
  };

  if (
    typeof candidate.downloadUrl === "string" &&
    candidate.downloadUrl.length > 0
  ) {
    return candidate.downloadUrl;
  }

  if (typeof candidate.zipUrl === "string" && candidate.zipUrl.length > 0) {
    return candidate.zipUrl;
  }

  return null;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversions({
  project,
  selectedFiles,
  onClearSelection,
  onConversionComplete,
  userRole,
}: UseConversionsDeps): UseConversionsReturn {
  const [supportedFormats, setSupportedFormats] = useState<Record<
    string,
    string[]
  > | null>(null);
  const [convertingFiles, setConvertingFiles] = useState<Set<string>>(
    new Set(),
  );
  const [activeConversions, setActiveConversions] = useState<
    ActiveConversion[]
  >([]);
  const [downloadModal, setDownloadModal] = useState<DownloadModal | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const response = await conversionService.formats();
        const normalized = normalizeSupportedFormats(response);
        setSupportedFormats(
          Object.keys(normalized).length > 0
            ? normalized
            : FALLBACK_SUPPORTED_FORMATS,
        );
      } catch (error) {
        logger.warn("Failed to fetch supported formats, using fallback map", {
          error: error instanceof Error ? error.message : String(error),
        });
        setSupportedFormats(FALLBACK_SUPPORTED_FORMATS);
      }
    })();
  }, []);

  const isConversionSupported = (
    fileType: string,
    targetFormat: string,
  ): boolean => {
    const map = supportedFormats ?? FALLBACK_SUPPORTED_FORMATS;
    return isConversionSupportedByFormats(map, fileType, targetFormat);
  };

  const areFilesCompatible = (fileIds: string[], format: string): boolean => {
    if (!project || fileIds.length === 0) return false;

    const selected = project.files.filter((file) => fileIds.includes(file.id));
    if (selected.length === 0) return false;

    return selected.every((file) => isConversionSupported(file.type, format));
  };

  const handleConvert = async (
    fileId: string,
    format: "pdf" | "ifc",
  ): Promise<void> => {
    const file = project?.files.find((entry) => entry.id === fileId);
    if (!file) return;

    if (!isConversionSupported(file.type, format)) {
      toast.error(`Cannot convert ${file.type} to ${format.toUpperCase()}`, {
        description: "This conversion is not supported.",
      });
      return;
    }

    const trackingId = `${fileId}-${format}-${Date.now()}`;

    try {
      addConverting(setConvertingFiles, fileId);
      setActiveConversions((prev) => [
        ...prev,
        {
          id: trackingId,
          fileId,
          fileName: file.name,
          format,
          status: "pending",
          startTime: Date.now(),
        },
      ]);

      const response = await conversionService.start(fileId, format);
      const conversionId = response.conversion?.id;
      const immediateStatus = normalizeTrackerStatus(
        response.conversion?.status,
      );

      if (!conversionId) {
        throw new Error("No conversion ID returned");
      }

      if (immediateStatus === "completed") {
        removeConverting(setConvertingFiles, fileId);
        patchConversion(setActiveConversions, trackingId, {
          status: "completed",
          conversionId,
          downloadUrl:
            response.downloadUrl || `/api/conversion/${conversionId}/download`,
        });
        return;
      }

      patchConversion(setActiveConversions, trackingId, {
        status: immediateStatus === "failed" ? "failed" : "processing",
        conversionId,
        error:
          immediateStatus === "failed"
            ? "Conversion failed to start"
            : undefined,
      });

      if (immediateStatus === "failed") {
        removeConverting(setConvertingFiles, fileId);
        return;
      }

      pollWithBackoff({
        fn: async () => {
          return await conversionService.status(conversionId);
        },
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        maxRetries: 30,
        onSuccess: (data: ConversionStatusResponse) => {
          const normalized = normalizeTrackerStatus(data.status);

          if (normalized === "completed") {
            removeConverting(setConvertingFiles, fileId);
            patchConversion(setActiveConversions, trackingId, {
              status: "completed",
              conversionId,
              downloadUrl: `/api/conversion/${conversionId}/download`,
            });
            return true;
          }

          if (normalized === "failed") {
            removeConverting(setConvertingFiles, fileId);
            patchConversion(setActiveConversions, trackingId, {
              status: "failed",
              error: data.lastError || data.error || "Unknown error",
            });
            return true;
          }
        },
        onError: (error) =>
          logger.warn("Failed to check conversion status", {
            error: error.message,
            conversionId,
          }),
        onTimeout: () => {
          removeConverting(setConvertingFiles, fileId);
          patchConversion(setActiveConversions, trackingId, {
            status: "failed",
            error: "Conversion timed out",
          });
          toast.warning("Conversion timed out", {
            description: "The conversion is taking longer than expected.",
          });
        },
      });
    } catch (error: unknown) {
      removeConverting(setConvertingFiles, fileId);
      patchConversion(setActiveConversions, trackingId, {
        status: "failed",
        error:
          error instanceof Error ? error.message : "Failed to start conversion",
      });
      showError(error, userRole, "Failed to start conversion");
    }
  };

  const handleBulkConvert = async (format: "pdf" | "ifc"): Promise<void> => {
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter((fileId) => {
      const file = project?.files.find((entry) => entry.id === fileId);
      return file ? isConversionSupported(file.type, format) : false;
    });

    if (validFiles.length === 0) {
      toast.error(
        `None of the selected files support conversion to ${format.toUpperCase()}`,
      );
      return;
    }

    if (validFiles.length < selectedFiles.length) {
      toast.warning(
        `Skipping ${selectedFiles.length - validFiles.length} files that do not support ${format.toUpperCase()} conversion.`,
      );
    }

    try {
      toast.info(
        `Starting parallel batch conversion to ${format.toUpperCase()} for ${validFiles.length} files...`,
        {
          description: "All conversions will run simultaneously",
        },
      );

      addConverting(setConvertingFiles, validFiles);

      const response = await conversionService.batch({
        fileIds: validFiles,
        format,
      });
      const batchId = response.batchId;
      const started = Number(response.started ?? response.enqueued ?? 0);
      const failed = Number(response.failed ?? 0);
      const errors = Array.isArray(response.errors) ? response.errors : [];

      if (failed > 0 && errors.length > 0) {
        toast.warning(`${failed} file(s) could not be converted`, {
          description: errors.map((entry) => entry.error).join(", "),
        });
      }

      if (started === 0) {
        removeConverting(setConvertingFiles, validFiles);
        return;
      }

      toast.success(
        `Batch started: ${started} conversions running in parallel`,
      );

      pollWithBackoff({
        fn: async () => {
          return await conversionService.batchStatus(batchId);
        },
        initialDelayMs: 3000,
        maxDelayMs: 30000,
        maxRetries: 30,
        onSuccess: (data: BatchConversionStatusResponse) => {
          const normalized = normalizeBatchStatus(data);
          const { status, summary } = normalized;
          const total = summary.total;

          if (status === "processing") {
            toast.info(
              `Batch progress: ${summary.completed}/${total} completed`,
              {
                id: `batch-${batchId}`,
                description:
                  summary.processing > 0
                    ? `${summary.processing} still processing...`
                    : "Finishing up...",
              },
            );
          }

          if (status === "completed" || status === "failed") {
            removeConverting(setConvertingFiles, validFiles);

            const downloadUrl = getBatchDownloadUrl(data);
            const downloadReady =
              summary.completed > 0 &&
              summary.processing === 0 &&
              summary.pending === 0;

            if (downloadReady && summary.completed > 0) {
              if (downloadUrl) {
                toast.success("Batch conversion complete!", {
                  id: `batch-${batchId}`,
                  description: `${summary.completed} files ready.`,
                  action: {
                    label: "Download",
                    onClick: () => window.open(downloadUrl, "_blank"),
                  },
                  duration: 30000,
                });
              } else {
                toast.success("Batch conversion complete!", {
                  id: `batch-${batchId}`,
                  description: `${summary.completed} files are ready for next steps.`,
                });
              }
            } else if (summary.failed === total) {
              toast.error("All conversions failed", { id: `batch-${batchId}` });
            }

            onConversionComplete();
            return true;
          }
        },
        onError: (error) =>
          logger.warn("Failed to check batch status", { error: error.message }),
        onTimeout: () => {
          removeConverting(setConvertingFiles, validFiles);
          toast.warning("Batch conversion polling timed out.", {
            id: `batch-${batchId}`,
            description: "Refresh to check status.",
          });
        },
      });
    } catch (error: unknown) {
      removeConverting(setConvertingFiles, validFiles);
      showError(error, userRole, "Failed to start batch conversion");
    }

    onClearSelection();
  };

  const handleSaveToProject = async (): Promise<void> => {
    if (!downloadModal?.conversionId) return;

    try {
      toast.info("Saving file to project...");
      await conversionService.saveToProject(downloadModal.conversionId);
      toast.success("File saved to project successfully!");
      setDownloadModal(null);
      onConversionComplete();
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { details?: unknown } };
        message?: string;
      };

      const errorMessage = axiosError.response?.data?.details
        ? typeof axiosError.response.data.details === "object"
          ? JSON.stringify(axiosError.response.data.details)
          : String(axiosError.response.data.details)
        : axiosError.message || "Unknown error";

      showError(error, userRole, "Failed to save file to project");
      toast.error("Save Failed", {
        description: errorMessage,
        duration: 10000,
      });
    }
  };

  return {
    supportedFormats,
    isConversionSupported,
    areFilesCompatible,
    convertingFiles,
    handleConvert,
    handleBulkConvert,
    activeConversions,
    setActiveConversions,
    downloadModal,
    setDownloadModal,
    handleSaveToProject,
  };
}
