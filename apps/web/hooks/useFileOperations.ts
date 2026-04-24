"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/axios-config";
import {
  authService,
  filesService,
  translationService,
} from "@/lib/api/services";
import type { ProjectDetail, ProjectFileDetail } from "@/lib/api/types";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFileOperationsReturn {
  // --- Upload ---
  uploading: boolean;
  uploadProgress: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;

  // --- APS Browser / Import ---
  isApsBrowserOpen: boolean;
  setIsApsBrowserOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleApsImport: (fileData: Record<string, unknown>) => Promise<void>;

  // --- View ---
  viewerModal: {
    isOpen: boolean;
    file: ProjectFileDetail;
    token?: string;
  } | null;
  setViewerModal: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      file: ProjectFileDetail;
      token?: string;
    } | null>
  >;
  handleViewFile: (file: ProjectFileDetail) => Promise<void>;

  // --- Delete ---
  fileToDelete: string | null;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deletingFile: boolean;
  confirmDeleteFile: (fileId: string) => void;
  handleDeleteFile: () => Promise<void>;

  // --- Translation ---
  translatingFiles: Set<string>;
  handleStartTranslation: (file: ProjectFileDetail) => Promise<void>;

  // --- Batch download ---
  handleBatchDownload: () => Promise<void>;

  // --- Validation (client-side) ---
  handleValidate: (file: ProjectFileDetail) => void;
}

interface UseFileOperationsDeps {
  projectId: string;
  project: ProjectDetail | null;
  fetchProject: () => Promise<void>;
  selectedFiles: string[];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

// formatSize — local copy for validation messages (canonical export in FilesTabContent)
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFileOperations(
  deps: UseFileOperationsDeps,
): UseFileOperationsReturn {
  const { projectId, fetchProject, selectedFiles } = deps;
  const { user } = useUser();

  // --- Upload state ---
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- APS browser state ---
  const [isApsBrowserOpen, setIsApsBrowserOpen] = useState(false);

  // --- Viewer modal state ---
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    file: ProjectFileDetail;
    token?: string;
  } | null>(null);

  // --- Delete state ---
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);

  // --- Translation state ---
  const [translatingFiles, setTranslatingFiles] = useState<Set<string>>(
    new Set(),
  );

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const MAX_SIZE = 200 * 1024 * 1024; // 200MB

      // 1. Validate Size
      if (file.size > MAX_SIZE) {
        toast.error("File too large", {
          description: `File size (${formatSize(file.size)}) exceeds the 100MB limit.`,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // 2. Validate Extension
      const allowedExtensions = ["rvt", "dwg", "pdf", "ifc", "nwc", "dwf"];
      const fileExt = file.name.split(".").pop()?.toLowerCase();

      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        toast.error("Unsupported file format", {
          description: `Allowed formats: ${allowedExtensions.join(", ").toUpperCase()}`,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      setUploading(true);
      setUploadProgress(0);
      const toastId = toast.loading(`Uploading ${file.name}... 0%`);

      try {
        const response = await apiClient.post("/api/files/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total,
              );
              setUploadProgress(percent);
              toast.loading(`Uploading ${file.name}... ${percent}%`, {
                id: toastId,
              });
            }
          },
        });

        if (response.data.warning) {
          toast.warning("File uploaded locally only", {
            description: "APS Error: " + response.data.warning,
            id: toastId,
          });
        } else {
          toast.success("File uploaded successfully", { id: toastId });
        }

        fetchProject();
      } catch (error: unknown) {
        showError(error, user?.role, "File upload failed");
        toast.dismiss(toastId);
      } finally {
        setUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [projectId, user?.role, fetchProject],
  );

  // ---------------------------------------------------------------------------
  // APS Import
  // ---------------------------------------------------------------------------

  const handleApsImport = useCallback(
    async (fileData: Record<string, unknown>) => {
      try {
        await filesService.importAps({
          ...(fileData as {
            apsProjectId: string;
            apsItemId: string;
            apsVersionId?: string;
            fileName: string;
          }),
          projectId,
        });
        toast.success("File imported successfully");
        fetchProject();
      } catch (error) {
        showError(error, user?.role, "Failed to import file");
      }
    },
    [projectId, user?.role, fetchProject],
  );

  // ---------------------------------------------------------------------------
  // View file
  // ---------------------------------------------------------------------------

  const handleViewFile = useCallback(async (file: ProjectFileDetail) => {
    if (file.status !== "READY" || !file.apsUrn) {
      toast.error("File is not ready for viewing");
      return;
    }

    let token: string | undefined;

    if (file.apsProjectId) {
      try {
        const data = await authService.userToken();
        token = data.access_token;
      } catch {
        logger.info("No user token available for ACC file");
      }
    }

    setViewerModal({ isOpen: true, file, token });
  }, []);

  // ---------------------------------------------------------------------------
  // Delete file
  // ---------------------------------------------------------------------------

  const confirmDeleteFile = useCallback((fileId: string) => {
    setFileToDelete(fileId);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeleteFile = useCallback(async () => {
    if (!fileToDelete) return;

    setDeletingFile(true);
    try {
      await filesService.delete(fileToDelete);
      setIsDeleteDialogOpen(false);
      setFileToDelete(null);
      toast.success("File deleted successfully");
      fetchProject();
    } catch (error) {
      showError(error, user?.role, "Failed to delete file");
    } finally {
      setDeletingFile(false);
    }
  }, [fileToDelete, user?.role, fetchProject]);

  // ---------------------------------------------------------------------------
  // Translation
  // ---------------------------------------------------------------------------

  const handleStartTranslation = useCallback(
    async (file: ProjectFileDetail) => {
      const normalizedStatus = (file.status || "").toUpperCase();

      if (normalizedStatus === "UPLOADING") {
        toast.info("Upload still in progress", {
          description:
            "Wait until APS upload finishes before starting translation.",
        });
        return;
      }

      if (!file.apsUrn) {
        toast.error("Cannot start translation", {
          description:
            "This file has no APS URN. Re-upload the file to continue.",
        });
        return;
      }

      try {
        setTranslatingFiles((prev) => new Set(prev).add(file.id));
        toast.info("Starting translation...");

        const force =
          normalizedStatus === "FAILED" || normalizedStatus === "READY";
        const data = await translationService.start(file.id, { force });

        if (data.status === "READY") {
          toast.success("File is already translated and ready!");
        } else if (
          data.status === "TRANSLATING" &&
          data.message.includes("already")
        ) {
          toast.info("Translation is already in progress.");
        } else {
          toast.success("Translation started!");
        }

        fetchProject();
      } catch (error: unknown) {
        showError(error, user?.role, "Failed to start translation");
      } finally {
        setTimeout(() => {
          setTranslatingFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(file.id);
            return newSet;
          });
        }, 1000);
      }
    },
    [user?.role, fetchProject],
  );

  // ---------------------------------------------------------------------------
  // Batch download
  // ---------------------------------------------------------------------------

  const handleBatchDownload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > 2) {
      try {
        toast.info("Preparing ZIP archive...");
        const response = await apiClient.post(
          "/api/files/batch-download",
          {
            fileIds: selectedFiles,
          },
          {
            responseType: "blob",
          },
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `project_files_${Date.now()}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        toast.success("ZIP download started");
      } catch (error) {
        logger.error("Batch download failed", {
          error: error instanceof Error ? error.message : String(error),
          selectedCount: selectedFiles.length,
        });
        showError(error, user?.role, "Batch download failed");
        toast.error("Failed to create ZIP archive");
      }
    } else {
      selectedFiles.forEach((fileId, index) => {
        setTimeout(() => {
          window.open(`/api/files/${fileId}/download`, "_blank");
        }, index * 1000);
      });
      toast.success(`Started download for ${selectedFiles.length} files`);
    }
  }, [selectedFiles, user?.role]);

  // ---------------------------------------------------------------------------
  // Validation (client-side)
  // ---------------------------------------------------------------------------

  const handleValidate = useCallback((file: ProjectFileDetail) => {
    const namingRegex = /^[A-Z0-9]+-[A-Z]+-[0-9]+/i;
    const issues: string[] = [];

    if (!namingRegex.test(file.name)) {
      issues.push(
        "❌ Naming does NOT match standard (PROJECT-DISCIPLINE-NUMBER)",
      );
    } else {
      issues.push("✅ Naming follows standard format");
    }

    if (file.size > 200 * 1024 * 1024) {
      issues.push("⚠️ File size exceeds recommended 100MB");
    } else {
      issues.push("✅ File size is acceptable");
    }

    const validTypes = ["RVT", "DWG", "IFC", "PDF"];
    if (validTypes.includes(file.type)) {
      issues.push("✅ File type is supported");
    } else {
      issues.push("❌ File type may not be supported");
    }

    if (file.status === "READY") {
      issues.push("✅ File is ready for use");
    } else if (file.status === "FAILED") {
      issues.push("❌ File translation failed");
    } else {
      issues.push("⏳ File is still processing");
    }

    const hasErrors = issues.some((i) => i.includes("❌"));
    const message = `Validation Results for "${file.name}":\n\n${issues.join("\n")}`;

    if (hasErrors) {
      toast.warning(message, { duration: 8000 });
    } else {
      toast.success(message, { duration: 8000 });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    uploading,
    uploadProgress,
    fileInputRef,
    handleFileUpload,

    isApsBrowserOpen,
    setIsApsBrowserOpen,
    handleApsImport,

    viewerModal,
    setViewerModal,
    handleViewFile,

    fileToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    deletingFile,
    confirmDeleteFile,
    handleDeleteFile,

    translatingFiles,
    handleStartTranslation,

    handleBatchDownload,

    handleValidate,
  };
}
