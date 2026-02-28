"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/axios-config";
import {
  usePollingWithBackoff,
} from "@/hooks/usePollingWithBackoff";
import {
  Upload,
  FileText,
  Box,
  Layers,
  MoreVertical,
  RefreshCw,
  Clock,
  HardDrive,
  CheckCircle,
  Trash2,
  GitCompare,
  CheckSquare,
  X,
  Search,
  Users,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ViewerModal } from "@/components/ViewerModal";
import { ApsBrowser } from "@/components/ApsBrowser";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

// New Components
import { ProjectHeader } from "@/components/ProjectHeader";
import { ProjectDetailsPanel } from "@/components/ProjectDetailsPanel";
import { EmptyState } from "@/components/EmptyState";
import { FileRow } from "@/components/FileRow";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs-simple";
import {
  ProjectSettingsModal,
  ProjectMember,
} from "@/components/ProjectSettingsModal";
import {
  ConversionTracker,
} from "@/components/ConversionTracker";
import { ShareProjectDialog } from "@/components/ShareProjectDialog";
import { ProjectMembersList } from "@/components/ProjectMembersList";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { useFileSelection } from "@/hooks/useFileSelection";
import { useFileOperations, formatSize } from "@/hooks/useFileOperations";
import { useConversions } from "@/hooks/useConversions";
import type { ProjectFileDetail } from "@/lib/api/types";

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
    fileToDelete,
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
    convertingFiles,
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

    const processingFiles = project.files.filter(
      (f) =>
        f.status === "TRANSLATING" ||
        f.status === "PROCESSING" ||
        f.status === "PENDING",
    );

    if (processingFiles.length === 0) return;

    try {
      const response = await apiClient.post("/api/files/sync-status", {
        fileIds: processingFiles.map((f) => f.id),
      });

      // Always update progress for all files returned
      if (response.data.files && response.data.files.length > 0) {
        setProject((prev) => {
          if (!prev) return null;
          const newFiles = prev.files.map((f) => {
            const fileUpdate = response.data.files.find(
              (u: { id: string; status: string; progress: number }) =>
                u.id === f.id,
            );
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
      if (response.data.updates && response.data.updates.length > 0) {
        response.data.updates.forEach((u: { id: string; status: string }) => {
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

  const hasProcessingFiles = (project?.files ?? []).some(
    (f) =>
      f.status === "TRANSLATING" ||
      f.status === "PROCESSING" ||
      f.status === "PENDING",
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
          {project.files.length === 0 ? (
            <EmptyState
              title="No files uploaded"
              description="Upload your first file to get started with this project."
              primaryActionLabel="Upload File"
              onPrimaryAction={() => fileInputRef.current?.click()}
            />
          ) : (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                {/* Left: Search & Filter */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-dom-blue/50 transition-all"
                    />
                  </div>

                  <div className="flex items-center bg-black/20 rounded-lg p-1 border border-white/10">
                    {["ALL", "RVT", "DWG", "PDF"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          activeFilter === filter
                            ? "bg-dom-blue text-white shadow-lg"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {filter === "ALL" ? "All Files" : filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Batch Actions */}
                {selectedFiles.length > 0 && (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <span className="text-xs text-gray-400 mr-2">
                      {selectedFiles.length} selected
                    </span>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBatchDownload}
                            className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-dom-blue/20 hover:text-dom-blue"
                          >
                            <HardDrive className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download Selected</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkConvert("pdf")}
                            className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-dom-blue/20 hover:text-dom-blue"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Convert to PDF</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCompareFiles}
                            disabled={selectedFiles.length !== 2}
                            className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-dom-blue/20 hover:text-dom-blue disabled:opacity-30"
                          >
                            <GitCompare className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Compare (Select 2)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFiles([])}
                      className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* File List Header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-white/10">
                <div className="w-6">
                  <Checkbox
                    checked={
                      selectedFiles.length === project.files.length &&
                      project.files.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                    className="border-white/20 data-[state=checked]:bg-dom-blue data-[state=checked]:border-dom-blue"
                  />
                </div>
                <div>Name</div>
                <div className="w-24 text-center">Type</div>
                <div className="w-24 text-center">Size</div>
                <div className="w-32 text-center">Status</div>
                <div className="w-40"></div>
              </div>

              {/* Grouped Files List */}
              <div className="space-y-8">
                {activeFilter === "ALL" && groupedFiles ? (
                  Object.entries(groupedFiles).map(([type, files]: [string, ProjectFileDetail[]]) => {
                    if (files.length === 0) return null;
                    return (
                      <div key={type} className="space-y-2 animate-fade-in">
                        <div className="flex items-center gap-2 px-2">
                          <span className="text-xs font-bold text-dom-blue bg-dom-blue/10 px-2 py-1 rounded-md">
                            {type}
                          </span>
                          <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                        </div>
                        <div className="space-y-1">
                          {files.map((file) => (
                            <FileRow
                              key={file.id}
                              fileName={file.name}
                              fileType={file.type}
                              fileSize={formatSize(file.size)}
                              updatedAt={new Date(
                                file.createdAt,
                              ).toLocaleDateString()}
                              status={file.status}
                              progress={file.progress}
                              isSelected={selectedFiles.includes(file.id)}
                              onSelect={() => toggleFileSelection(file.id)}
                              onView={() => handleViewFile(file)}
                              onRetry={() => handleStartTranslation(file.id)}
                              actions={
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewFile(file);
                                    }}
                                    className="h-8 px-3 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                                  >
                                    <Box className="h-3 w-3 mr-2" />
                                    View
                                  </Button>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-white/10 rounded-full"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-56 glass-panel border-white/10"
                                    >
                                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
                                        File Actions
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator className="bg-white/10" />

                                      {file.status === "READY" && (
                                        <>
                                          <DropdownMenuGroup>
                                            <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                              <RefreshCw className="h-3 w-3" />{" "}
                                              CONVERT
                                            </DropdownMenuLabel>
                                            {isConversionSupported(
                                              file.type,
                                              "pdf",
                                            ) && (
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleConvert(file.id, "pdf")
                                                }
                                                className="focus:bg-white/10 cursor-pointer"
                                              >
                                                <FileText className="mr-2 h-4 w-4 text-red-400" />
                                                <span>To PDF</span>
                                              </DropdownMenuItem>
                                            )}
                                            {isConversionSupported(
                                              file.type,
                                              "ifc",
                                            ) && (
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleConvert(file.id, "ifc")
                                                }
                                                className="focus:bg-white/10 cursor-pointer"
                                              >
                                                <Box className="mr-2 h-4 w-4 text-blue-400" />
                                                <span>To IFC</span>
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuGroup>
                                          <DropdownMenuSeparator className="bg-white/10" />
                                        </>
                                      )}

                                      <DropdownMenuGroup>
                                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                          <Layers className="h-3 w-3" /> MANAGE
                                        </DropdownMenuLabel>
                                        <Link
                                          href={`/dashboard/files/${file.id}`}
                                        >
                                          <DropdownMenuItem className="focus:bg-white/10 cursor-pointer">
                                            <Clock className="mr-2 h-4 w-4 text-orange-400" />
                                            <span>History & Versions</span>
                                          </DropdownMenuItem>
                                        </Link>
                                        <DropdownMenuItem
                                          onClick={() => handleValidate(file)}
                                          className="focus:bg-white/10 cursor-pointer"
                                        >
                                          <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
                                          <span>Validate Standards</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuGroup>
                                      <DropdownMenuSeparator className="bg-white/10" />

                                      <DropdownMenuItem
                                        onClick={() =>
                                          confirmDeleteFile(file.id)
                                        }
                                        className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete File</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              }
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-1 animate-fade-in">
                    {filteredFiles.length > 0 ? (
                      filteredFiles.map((file) => (
                        <FileRow
                          key={file.id}
                          fileName={file.name}
                          fileType={file.type}
                          fileSize={formatSize(file.size)}
                          updatedAt={new Date(
                            file.createdAt,
                          ).toLocaleDateString()}
                          status={file.status}
                          progress={file.progress}
                          isSelected={selectedFiles.includes(file.id)}
                          onSelect={() => toggleFileSelection(file.id)}
                          onView={() => handleViewFile(file)}
                          onRetry={() => handleStartTranslation(file.id)}
                          actions={
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewFile(file);
                                }}
                                className="h-8 px-3 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                              >
                                <Box className="h-3 w-3 mr-2" />
                                View
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-white/10 rounded-full"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-56 glass-panel border-white/10"
                                >
                                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
                                    File Actions
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-white/10" />

                                  {file.status === "READY" && (
                                    <>
                                      <DropdownMenuGroup>
                                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                          <RefreshCw className="h-3 w-3" />{" "}
                                          CONVERT
                                        </DropdownMenuLabel>
                                        {isConversionSupported(
                                          file.type,
                                          "pdf",
                                        ) && (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleConvert(file.id, "pdf")
                                            }
                                            className="focus:bg-white/10 cursor-pointer"
                                          >
                                            <FileText className="mr-2 h-4 w-4 text-red-400" />
                                            <span>To PDF</span>
                                          </DropdownMenuItem>
                                        )}
                                        {isConversionSupported(
                                          file.type,
                                          "ifc",
                                        ) && (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleConvert(file.id, "ifc")
                                            }
                                            className="focus:bg-white/10 cursor-pointer"
                                          >
                                            <Box className="mr-2 h-4 w-4 text-blue-400" />
                                            <span>To IFC</span>
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuGroup>
                                      <DropdownMenuSeparator className="bg-white/10" />
                                    </>
                                  )}

                                  <DropdownMenuGroup>
                                    <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                      <Layers className="h-3 w-3" /> MANAGE
                                    </DropdownMenuLabel>
                                    <Link href={`/dashboard/files/${file.id}`}>
                                      <DropdownMenuItem className="focus:bg-white/10 cursor-pointer">
                                        <Clock className="mr-2 h-4 w-4 text-orange-400" />
                                        <span>History & Versions</span>
                                      </DropdownMenuItem>
                                    </Link>
                                    <DropdownMenuItem
                                      onClick={() => handleValidate(file)}
                                      className="focus:bg-white/10 cursor-pointer"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
                                      <span>Validate Standards</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                  <DropdownMenuSeparator className="bg-white/10" />

                                  <DropdownMenuItem
                                    onClick={() => confirmDeleteFile(file.id)}
                                    className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete File</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          }
                        />
                      ))
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        No files found matching your filters.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upload Zone (Moved to bottom) */}
              <div
                className={`glass-panel border-dashed border-2 border-white/10 rounded-2xl p-8 text-center transition-all duration-300 group ${uploading ? "bg-primary/5 border-primary/30" : "hover:bg-white/5 hover:border-primary/30"}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload({
                      target: { files: e.dataTransfer.files },
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
              >
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="p-4 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-300">
                    <Upload
                      className={`h-8 w-8 ${uploading ? "text-primary animate-bounce" : "text-gray-400 group-hover:text-primary"}`}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {uploading
                        ? "Uploading..."
                        : "Drop files here or click to upload"}
                    </h3>
                    <p className="text-sm text-gray-400">
                      Support for RVT, DWG, PDF, IFC, NWC
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-2 border-white/10 hover:bg-white/10"
                  >
                    Select Files
                  </Button>
                </div>
              </div>
            </div>
          )}
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

      {/* Bulk Actions Bar - Premium Slide-in */}
      {selectedFiles.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-xl border border-primary/20 text-foreground px-6 py-4 rounded-2xl shadow-2xl shadow-primary/20 flex items-center gap-6 z-50 animate-slide-up ring-1 ring-white/10">
          <div className="flex items-center gap-3 border-r border-white/10 pr-6">
            <div className="bg-primary/20 p-2 rounded-lg">
              <CheckSquare className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-lg">
              {selectedFiles.length}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                selected
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Compare Action */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCompareFiles}
                      disabled={
                        selectedFiles.length !== 2 ||
                        !areFilesCompatibleForCompare(selectedFiles)
                      }
                      className="hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <GitCompare className="mr-2 h-4 w-4" /> Compare
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedFiles.length !== 2
                    ? "Select exactly 2 files to compare"
                    : !areFilesCompatibleForCompare(selectedFiles)
                      ? "Selected files must be of the same type (2D or 3D)"
                      : "Compare selected versions"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Convert Actions */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBulkConvert("pdf")}
                      disabled={!areFilesCompatible(selectedFiles, "pdf")}
                      className="hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <FileText className="mr-2 h-4 w-4" /> Convert to PDF
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!areFilesCompatible(selectedFiles, "pdf")
                    ? "Selection contains files that cannot be converted to PDF"
                    : "Convert selected files to PDF"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBulkConvert("ifc")}
                      disabled={!areFilesCompatible(selectedFiles, "ifc")}
                      className="hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Box className="mr-2 h-4 w-4" /> Convert to IFC
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!areFilesCompatible(selectedFiles, "ifc")
                    ? "Selection contains files that cannot be converted to IFC"
                    : "Convert selected files to IFC"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-6 w-px bg-white/10 mx-2"></div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFiles([])}
              className="hover:bg-red-500/10 hover:text-red-500 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

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
            await apiClient.post(
              `/api/conversion/${conversion.conversionId}/save-to-project`,
            );
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
