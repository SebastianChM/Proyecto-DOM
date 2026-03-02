import { useState, useEffect } from "react";
import apiClient from "@/lib/axios-config";
import { pollWithBackoff } from "@/hooks/usePollingWithBackoff";
import { toast } from "sonner";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import type { ActiveConversion } from "@/components/ConversionTracker";
import type { ProjectFileDetail } from "@/lib/api/types";

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
  setSelectedFiles: (ids: string[]) => void;
  fetchProject: () => void;
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
  setActiveConversions: React.Dispatch<React.SetStateAction<ActiveConversion[]>>;
  downloadModal: DownloadModal | null;
  setDownloadModal: React.Dispatch<React.SetStateAction<DownloadModal | null>>;
  handleSaveToProject: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal helpers (reduce repetitive set-state boilerplate)
// ---------------------------------------------------------------------------

/** Add fileIds to the converting set */
const addConverting = (
  setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ids: string | string[],
) => {
  const arr = Array.isArray(ids) ? ids : [ids];
  setter((prev) => {
    const s = new Set(prev);
    arr.forEach((id) => s.add(id));
    return s;
  });
};

/** Remove fileIds from the converting set */
const removeConverting = (
  setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ids: string | string[],
) => {
  const arr = Array.isArray(ids) ? ids : [ids];
  setter((prev) => {
    const s = new Set(prev);
    arr.forEach((id) => s.delete(id));
    return s;
  });
};

/** Patch a single ActiveConversion by trackingId */
const patchConversion = (
  setter: React.Dispatch<React.SetStateAction<ActiveConversion[]>>,
  trackingId: string,
  patch: Partial<ActiveConversion>,
) => {
  setter((prev) =>
    prev.map((c) => (c.id === trackingId ? { ...c, ...patch } : c)),
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversions({
  project,
  selectedFiles,
  setSelectedFiles,
  fetchProject,
  userRole,
}: UseConversionsDeps): UseConversionsReturn {
  const [supportedFormats, setSupportedFormats] = useState<Record<string, string[]> | null>(null);
  const [convertingFiles, setConvertingFiles] = useState<Set<string>>(new Set());
  const [activeConversions, setActiveConversions] = useState<ActiveConversion[]>([]);
  const [downloadModal, setDownloadModal] = useState<DownloadModal | null>(null);

  // ---- Fetch supported formats on mount ----
  useEffect(() => {
    (async () => {
      try {
        const response = await apiClient.get("/api/conversion/formats");
        if (response.data?.formats) setSupportedFormats(response.data.formats);
      } catch (error) {
        logger.warn("Failed to fetch supported formats", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, []);

  // ---- Helpers ----

  const isConversionSupported = (fileType: string, targetFormat: string): boolean => {
    const ext = fileType.toLowerCase();
    const fmt = targetFormat.toLowerCase();
    if (fmt === "pdf") return ext === "dwg" || ext === "dxf";
    if (fmt === "ifc") return ext !== "ifc" && ["rvt", "dwg"].includes(ext);
    return !!(supportedFormats?.[fmt]?.includes(ext));
  };

  const areFilesCompatible = (fileIds: string[], format: string): boolean => {
    if (!project) return false;
    return project.files.filter((f) => fileIds.includes(f.id)).every((f) => isConversionSupported(f.type, format));
  };

  // ---- Single file conversion ----

  const handleConvert = async (fileId: string, format: "pdf" | "ifc"): Promise<void> => {
    const file = project?.files.find((f) => f.id === fileId);
    if (!file) return;

    if (!isConversionSupported(file.type, format)) {
      toast.error(`Cannot convert ${file.type} to ${format.toUpperCase()}`, {
        description: "This conversion is not supported.",
      });
      return;
    }

    const tid = `${fileId}-${format}-${Date.now()}`;

    try {
      addConverting(setConvertingFiles, fileId);
      setActiveConversions((prev) => [
        ...prev,
        { id: tid, fileId, fileName: file.name, format, status: "pending", startTime: Date.now() },
      ]);

      const response = await apiClient.post(`/api/conversion/${fileId}`, { format });

      // Already completed recently
      if (response.data.downloadUrl && response.data.message === "Conversion already completed recently") {
        patchConversion(setActiveConversions, tid, {
          status: "completed",
          downloadUrl: response.data.downloadUrl,
          conversionId: response.data.conversion?.id,
        });
        removeConverting(setConvertingFiles, fileId);
        return;
      }

      if (!response.data.conversion) throw new Error("No conversion ID returned");
      const conversionId = response.data.conversion.id;

      patchConversion(setActiveConversions, tid, { status: "processing", conversionId });

      // Poll with exponential backoff
      pollWithBackoff({
        fn: async () => {
          const r = await apiClient.get(`/api/conversion/${conversionId}`);
          return r.data as { status: string; error?: string };
        },
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        maxRetries: 30,
        onSuccess: (data) => {
          if (data.status === "COMPLETED") {
            removeConverting(setConvertingFiles, fileId);
            patchConversion(setActiveConversions, tid, {
              status: "completed",
              downloadUrl: `/api/conversion/${conversionId}/download`,
              conversionId,
            });
            return true;
          }
          if (data.status === "FAILED") {
            removeConverting(setConvertingFiles, fileId);
            patchConversion(setActiveConversions, tid, {
              status: "failed",
              error: data.error || "Unknown error",
            });
            return true;
          }
        },
        onError: (err) => logger.warn("Failed to check conversion status", { error: err.message, conversionId }),
        onTimeout: () => {
          removeConverting(setConvertingFiles, fileId);
          patchConversion(setActiveConversions, tid, { status: "failed", error: "Conversion timed out" });
          toast.warning("Conversion timed out", { description: "The conversion is taking longer than expected." });
        },
      });
    } catch (error: unknown) {
      removeConverting(setConvertingFiles, fileId);
      patchConversion(setActiveConversions, tid, {
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to start conversion",
      });
      showError(error, userRole, "Failed to start conversion");
    }
  };

  // ---- Bulk conversion ----

  const handleBulkConvert = async (format: "pdf" | "ifc"): Promise<void> => {
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter((fid) => {
      const file = project?.files.find((f) => f.id === fid);
      return file ? isConversionSupported(file.type, format) : false;
    });

    if (validFiles.length === 0) {
      toast.error(`None of the selected files support conversion to ${format.toUpperCase()}`);
      return;
    }
    if (validFiles.length < selectedFiles.length) {
      toast.warning(
        `Skipping ${selectedFiles.length - validFiles.length} files that do not support ${format.toUpperCase()} conversion.`,
      );
    }

    try {
      toast.info(`Starting parallel batch conversion to ${format.toUpperCase()} for ${validFiles.length} files...`, {
        description: "All conversions will run simultaneously",
      });

      addConverting(setConvertingFiles, validFiles);

      const response = await apiClient.post("/api/conversion/batch", { fileIds: validFiles, format });
      const { batchId, started, failed, errors } = response.data;

      if (failed > 0) {
        toast.warning(`${failed} file(s) could not be converted`, {
          description: errors.map((e: { error: string }) => e.error).join(", "),
        });
      }
      if (started === 0) {
        removeConverting(setConvertingFiles, validFiles);
        return;
      }

      toast.success(`Batch started: ${started} conversions running in parallel`);

      pollWithBackoff({
        fn: async () => {
          const r = await apiClient.get(`/api/conversion/batch/${batchId}`);
          return r.data as {
            status: string;
            summary?: { completed?: number; failed?: number; processing?: number; pending?: number };
          };
        },
        initialDelayMs: 3000,
        maxDelayMs: 30000,
        maxRetries: 30,
        onSuccess: (data) => {
          const { status, summary } = data;
          if (!summary) { logger.warn("Batch status response missing summary"); return; }

          const total = (summary.completed || 0) + (summary.failed || 0) + (summary.processing || 0) + (summary.pending || 0);

          if (status === "processing") {
            toast.info(`Batch progress: ${summary.completed || 0}/${total} completed`, {
              id: `batch-${batchId}`,
              description: (summary.processing || 0) > 0 ? `${summary.processing} still processing...` : "Finishing up...",
            });
          }

          if (status === "completed" || status === "failed") {
            removeConverting(setConvertingFiles, validFiles);
            const downloadReady = (summary.completed ?? 0) > 0 && (summary.processing ?? 0) === 0 && (summary.pending ?? 0) === 0;

            if (downloadReady && (summary.completed || 0) > 0) {
              toast.success("Batch conversion complete!", {
                id: `batch-${batchId}`,
                description: `${summary.completed} files ready. Click to download ZIP.`,
                action: { label: "Download ZIP", onClick: () => window.open(`/api/conversion/batch/${batchId}/download`, "_blank") },
                duration: 30000,
              });
            } else if ((summary.failed || 0) === total) {
              toast.error("All conversions failed", { id: `batch-${batchId}` });
            }
            return true;
          }
        },
        onError: (err) => logger.warn("Failed to check batch status", { error: err.message }),
        onTimeout: () => {
          removeConverting(setConvertingFiles, validFiles);
          toast.warning("Batch conversion polling timed out.", { id: `batch-${batchId}`, description: "Refresh to check status." });
        },
      });
    } catch (error: unknown) {
      removeConverting(setConvertingFiles, validFiles);
      showError(error, userRole, "Failed to start batch conversion");
    }

    setSelectedFiles([]);
  };

  // ---- Save to project (download modal) ----

  const handleSaveToProject = async (): Promise<void> => {
    if (!downloadModal?.conversionId) return;
    try {
      toast.info("Saving file to project...");
      await apiClient.post(`/api/conversion/${downloadModal.conversionId}/save-to-project`);
      toast.success("File saved to project successfully!");
      setDownloadModal(null);
      fetchProject();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { details?: unknown } }; message?: string };
      const errorMessage = axiosError.response?.data?.details
        ? typeof axiosError.response.data.details === "object"
          ? JSON.stringify(axiosError.response.data.details)
          : String(axiosError.response.data.details)
        : axiosError.message || "Unknown error";
      showError(error, userRole, "Failed to save file to project");
      toast.error("Save Failed", { description: errorMessage, duration: 10000 });
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
