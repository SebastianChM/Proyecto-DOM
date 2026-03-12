"use client";

import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { filesService, conversionService } from "@/lib/api/services";
import {
  usePollingWithBackoff,
} from "@/hooks/usePollingWithBackoff";
import { Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ViewerModal } from "@/components/ViewerModal";
import { ApsBrowser } from "@/components/ApsBrowser";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

import { ProjectHeader } from "@/components/ProjectHeader";
import { ProjectDetailsPanel } from "@/components/ProjectDetailsPanel";
import { FilesTabContent } from "@/components/FilesTabContent";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs-simple";
import {
  ProjectSettingsModal,
} from "@/components/ProjectSettingsModal";
import {
  ConversionTracker,
} from "@/components/ConversionTracker";
import { ShareProjectDialog } from "@/components/ShareProjectDialog";
import { ProjectMembersList } from "@/components/ProjectMembersList";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { useFileSelection } from "@/hooks/useFileSelection";
import { useFileOperations } from "@/hooks/useFileOperations";
import { useConversions } from "@/hooks/useConversions";
import { isFileLifecycleActive } from "@/lib/viewer/readiness";

export default function ProjectDetailPage() {
  const params = useParams();
  const { user } = useUser();
  const projectId = params.id as string;

  const {
    project,
    setProject,
    loading,
    fetchProject,
    members,
    isSettingsOpen,
    setIsSettingsOpen,
    isShareDialogOpen,
    setIsShareDialogOpen,
    handleUpdateProject,
    handleDeleteProject,
    handleInviteMember,
    handleUpdateMemberRole,
    handleRemoveMember,
  } = useProjectDetail(projectId);

  const router = useRouter();

  // RBAC Permissions

  const {
    can,
    role,
    refresh: refreshPermissions,
  } = useProjectPermissions(projectId);

  // File selection, search, filtering
  const {
    selectedFiles,
    setSelectedFiles,
    toggleFileSelection,
    toggleSelectAll,
    searchTerm,
    setSearchTerm,
    activeFilter,
    setActiveFilter,
    filteredFiles,
    groupedFiles,
    areFilesCompatibleForCompare,
  } = useFileSelection(project?.files ?? []);

  // File operations (upload, delete, translate, import, view, download)
  const {
    uploading,
    fileInputRef,
    handleFileUpload,
    isApsBrowserOpen,
    setIsApsBrowserOpen,
    handleApsImport,
    viewerModal,
    setViewerModal,
    handleViewFile,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    deletingFile,
    confirmDeleteFile,
    handleDeleteFile,
    handleStartTranslation,
    handleBatchDownload,
    handleValidate,
  } = useFileOperations({
    projectId,
    project,
    fetchProject,
    selectedFiles,
  });

  // Conversions (convert, bulk convert, save-to-project, format support)
  const {
    isConversionSupported,
    areFilesCompatible,
    handleConvert,
    handleBulkConvert,
    activeConversions,
    setActiveConversions,
    downloadModal,
    setDownloadModal,
    handleSaveToProject,
  } = useConversions({
    project,
    selectedFiles,
    setSelectedFiles,
    fetchProject,
    userRole: user?.role,
  });

  const checkFileStatuses = useCallback(async () => {
    if (!project) return;

    const processingFiles = project.files.filter((f) =>
      isFileLifecycleActive(f.status),
    );

    if (processingFiles.length === 0) return;

    try {
      const data = await filesService.syncStatus(
        processingFiles.map((f) => f.id),
      );

      // Always update progress for all files returned
      if (data.files && data.files.length > 0) {
        setProject((prev) => {
          if (!prev) return null;
          const newFiles = prev.files.map((f) => {
            const fileUpdate = data.files.find((u) => u.id === f.id);
            if (fileUpdate) {
              return {
                ...f,
                status: fileUpdate.status,
                progress: fileUpdate.progress,
              };
            }
            return f;
          });
          return { ...prev, files: newFiles };
        });
      }

      // Show toasts for status changes
      if (data.updates && data.updates.length > 0) {
        data.updates.forEach((u) => {
          if (u.status === "READY") {
            toast.success("File processing completed!");
          } else if (u.status === "FAILED") {
            toast.error("File processing failed.");
          }
        });
      }
    } catch (error) {
      logger.warn("Failed to sync file statuses", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [project]);

  const hasProcessingFiles = (project?.files ?? []).some((f) =>
    isFileLifecycleActive(f.status),
  );

  usePollingWithBackoff({
    fn: checkFileStatuses,
    enabled: hasProcessingFiles,
    initialDelayMs: 3000,
    maxDelayMs: 30000,
    maxRetries: 40,
    onTimeout: () => {
      toast.warning("File processing is taking longer than expected.", {
        description:
          "Automatic polling stopped. Refresh the page to check again.",
        duration: 10000,
      });
    },
    onError: () => {
      // Don't stop on transient network errors; backoff will space them out
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBulkValidate = () => {
    if (selectedFiles.length === 0) return;

    let passed = 0;
    let failed = 0;

    selectedFiles.forEach((fileId) => {
      const file = project?.files.find((f) => f.id === fileId);
      if (file) {
        const namingRegex = /^[A-Z0-9]+-[A-Z]+-[0-9]+/i;
        const isNamingValid = namingRegex.test(file.name);
        const isSizeValid = file.size <= 200 * 1024 * 1024;

        if (isNamingValid && isSizeValid) passed++;
        else failed++;
      }
    });

    toast.info(`Bulk Validation Complete`, {
      description: `${passed} passed, ${failed} failed. Check individual files for details.`,
    });

    setSelectedFiles([]);
  };

  const handleCompareFiles = () => {
    if (selectedFiles.length !== 2 || !project) return;

    const file1 = project.files.find((f) => f.id === selectedFiles[0]);
    const file2 = project.files.find((f) => f.id === selectedFiles[1]);

    if (file1?.apsUrn && file2?.apsUrn) {
      const isPdf = file1.name.toLowerCase().endsWith(".pdf");
      const isDwg = file1.name.toLowerCase().endsWith(".dwg");
      const type = isPdf || isDwg ? "2d" : "3d";

      router.push(
        `/dashboard/viewer/compare?primary=${file1.apsUrn}&diff=${file2.apsUrn}&type=${type}`,
      );
    } else {
      toast.error("Selected files must be processed (have URN) to compare.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-foreground">
        Loading...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen text-foreground">
        Project not found
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <ProjectHeader
        projectName={project.name}
        clientName={project.clientName || "DOM Client"}
        discipline={project.discipline || "Architecture"}
        status={(project.status as "Active" | "Archived" | "Draft") || "Active"}
        lastUpdated="Today"
        projectId={projectId}
        onNewFile={() => fileInputRef.current?.click()}
        onImportAps={() => setIsApsBrowserOpen(true)}
        onSettings={() => setIsSettingsOpen(true)}
      />

      {/* Hidden File Input */}
      <Input
        id="file"
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        disabled={uploading}
        accept=".rvt,.dwg,.pdf,.ifc,.nwc,.dwf"
        className="hidden"
      />

      <ProjectSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        projectName={project.name}
        members={members}
        currentUserRole={user?.role} // Assuming user object has role, or we need to fetch current user's project role
        onInviteMember={handleInviteMember}
        onUpdateMemberRole={handleUpdateMemberRole}
        onRemoveMember={handleRemoveMember}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="files">
            Files ({project.files.length})
          </TabsTrigger>
          <TabsTrigger value="details">Project Details</TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <ProjectDetailsPanel
            projectType={project.status || "Standard"}
            discipline={project.discipline || "Architecture"}
            ownerName={project.clientName || "DOM Client"}
            location={project.location || "Madrid, Spain"}
            startDate={
              project.startDate
                ? new Date(project.startDate).toISOString().split("T")[0]
                : "2024-01-01"
            }
            endDate={
              project.endDate
                ? new Date(project.endDate).toISOString().split("T")[0]
                : "2024-12-31"
            }
            notes={project.description || "No description provided."}
            onSave={handleUpdateProject}
          />
        </TabsContent>

        <TabsContent value="members">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Team Members</h3>
                <p className="text-sm text-muted-foreground">
                  {role === "OWNER"
                    ? "Manage who has access to this project"
                    : "People with access to this project"}
                </p>
              </div>
              {can.share && (
                <Button
                  onClick={() => setIsShareDialogOpen(true)}
                  className="gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Share Project
                </Button>
              )}
            </div>
            <ProjectMembersList
              projectId={projectId}
              canManageMembers={can.manageMembers}
            />
          </div>
        </TabsContent>

        <TabsContent value="files">
          <FilesTabContent
            files={{
              allFiles: project.files,
              filteredFiles,
              groupedFiles,
            }}
            selection={{
              selectedFiles,
              searchTerm,
              activeFilter,
              setSearchTerm,
              setActiveFilter,
              setSelectedFiles,
              toggleFileSelection,
              toggleSelectAll,
              areFilesCompatibleForCompare,
            }}
            operations={{
              fileInputRef,
              uploading,
              onUpload: handleFileUpload,
              onView: handleViewFile,
              onDelete: confirmDeleteFile,
              onStartTranslation: handleStartTranslation,
              onBatchDownload: handleBatchDownload,
              onValidate: handleValidate,
              onCompareFiles: handleCompareFiles,
            }}
            conversions={{
              isConversionSupported,
              areFilesCompatible,
              onConvert: handleConvert,
              onBulkConvert: handleBulkConvert,
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this file? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFile}
              disabled={deletingFile}
            >
              {deletingFile ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApsBrowser
        isOpen={isApsBrowserOpen}
        onClose={() => setIsApsBrowserOpen(false)}
        onImport={handleApsImport}
        projectId={params.id as string}
      />

      <ViewerModal
        isOpen={!!viewerModal}
        onClose={() => setViewerModal(null)}
        file={viewerModal?.file ? { ...viewerModal.file, apsUrn: viewerModal.file.apsUrn ?? null } : null}
        token={viewerModal?.token}
      />

      {/* Download Modal */}
      <Dialog
        open={!!downloadModal}
        onOpenChange={(open) => !open && setDownloadModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversion Complete</DialogTitle>
            <DialogDescription>
              Your {downloadModal?.format} file is ready.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <a
              href={downloadModal?.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-10 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Download {downloadModal?.format}
            </a>
            <Button onClick={handleSaveToProject}>Save to Project</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversion Tracker - shows active/completed conversions */}
      <ConversionTracker
        conversions={activeConversions}
        onDismiss={(id) => {
          setActiveConversions((prev) => prev.filter((c) => c.id !== id));
        }}
        onDownload={(conversion) => {
          if (conversion.downloadUrl) {
            window.open(conversion.downloadUrl, "_blank");
          }
        }}
        onSaveToProject={async (conversion) => {
          if (!conversion.conversionId) return;
          try {
            toast.info("Saving file to project...");
            await conversionService.saveToProject(conversion.conversionId);
            toast.success("File saved to project successfully!");
            setActiveConversions((prev) =>
              prev.filter((c) => c.id !== conversion.id),
            );
            fetchProject();
          } catch (error: unknown) {
            showError(error, user?.role, "Failed to save file to project");
          }
        }}
      />

      {/* Share Project Dialog */}
      <ShareProjectDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        projectId={projectId}
        projectName={project?.name || "Project"}
        onMemberAdded={refreshPermissions}
      />
    </div>
  );
}
