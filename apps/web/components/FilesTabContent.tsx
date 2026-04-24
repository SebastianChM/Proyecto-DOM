"use client";

import React from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/EmptyState";
import { FileRow } from "@/components/FileRow";
import type { ProjectFileDetail } from "@/lib/api/types";
import type { GroupedFiles } from "@/hooks/useFileSelection";

// ---------------------------------------------------------------------------
// formatSize — moved here from useFileOperations (presentation utility)
// ---------------------------------------------------------------------------

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ---------------------------------------------------------------------------
// Types — grouped prop objects to avoid prop explosion
// ---------------------------------------------------------------------------

interface FilesProps {
  allFiles: ProjectFileDetail[];
  filteredFiles: ProjectFileDetail[];
  groupedFiles: GroupedFiles | null;
}

interface SelectionProps {
  selectedFiles: string[];
  searchTerm: string;
  activeFilter: string;
  setSearchTerm: (v: string) => void;
  setActiveFilter: (v: string) => void;
  setSelectedFiles: (ids: string[]) => void;
  toggleFileSelection: (id: string) => void;
  toggleSelectAll: () => void;
  areFilesCompatibleForCompare: (ids: string[]) => boolean;
}

interface OperationsProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onView: (file: ProjectFileDetail) => void;
  onDelete: (fileId: string) => void;
  onStartTranslation: (fileId: string) => void;
  onBatchDownload: () => void;
  onValidate: (file: ProjectFileDetail) => void;
  onCompareFiles: () => void;
}

interface ConversionsProps {
  isConversionSupported: (fileType: string, format: string) => boolean;
  areFilesCompatible: (ids: string[], format: string) => boolean;
  onConvert: (fileId: string, format: "pdf" | "ifc") => void;
  onBulkConvert: (format: "pdf" | "ifc") => void;
}

export interface FilesTabContentProps {
  files: FilesProps;
  selection: SelectionProps;
  operations: OperationsProps;
  conversions: ConversionsProps;
}

// ---------------------------------------------------------------------------
// Internal: deduplicated file-actions dropdown (was duplicated in page.tsx)
// ---------------------------------------------------------------------------

function FileActionsDropdown({
  file,
  onDelete,
  onValidate,
  onConvert,
  isConversionSupported,
}: {
  file: ProjectFileDetail;
  onDelete: (id: string) => void;
  onValidate: (f: ProjectFileDetail) => void;
  onConvert: (id: string, fmt: "pdf" | "ifc") => void;
  isConversionSupported: (type: string, fmt: string) => boolean;
}) {
  return (
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
        className="w-56 bg-card border border-border border-white/10"
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
          File Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />

        {file.status === "READY" && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> CONVERT
              </DropdownMenuLabel>
              {isConversionSupported(file.type, "pdf") && (
                <DropdownMenuItem
                  onClick={() => onConvert(file.id, "pdf")}
                  className="focus:bg-white/10 cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4 text-red-400" />
                  <span>To PDF</span>
                </DropdownMenuItem>
              )}
              {isConversionSupported(file.type, "ifc") && (
                <DropdownMenuItem
                  onClick={() => onConvert(file.id, "ifc")}
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
            onClick={() => onValidate(file)}
            className="focus:bg-white/10 cursor-pointer"
          >
            <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
            <span>Validate Standards</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onClick={() => onDelete(file.id)}
          className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete File</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Internal: single FileRow + view button + dropdown (shared by both branches)
// ---------------------------------------------------------------------------

function FileRowWithActions({
  file,
  isSelected,
  onSelect,
  onView,
  onRetry,
  onDelete,
  onValidate,
  onConvert,
  isConversionSupported,
}: {
  file: ProjectFileDetail;
  isSelected: boolean;
  onSelect: () => void;
  onView: (f: ProjectFileDetail) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onValidate: (f: ProjectFileDetail) => void;
  onConvert: (id: string, fmt: "pdf" | "ifc") => void;
  isConversionSupported: (type: string, fmt: string) => boolean;
}) {
  return (
    <FileRow
      fileName={file.name}
      fileType={file.type}
      fileSize={formatSize(file.size)}
      updatedAt={new Date(file.createdAt).toLocaleDateString()}
      status={file.status}
      progress={file.progress}
      isSelected={isSelected}
      onSelect={onSelect}
      onView={() => onView(file)}
      onRetry={() => onRetry(file.id)}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onView(file);
            }}
            className="h-8 px-3 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
          >
            <Box className="h-3 w-3 mr-2" />
            View
          </Button>
          <FileActionsDropdown
            file={file}
            onDelete={onDelete}
            onValidate={onValidate}
            onConvert={onConvert}
            isConversionSupported={isConversionSupported}
          />
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilesTabContent({
  files,
  selection,
  operations,
  conversions,
}: FilesTabContentProps) {
  const {
    allFiles,
    filteredFiles,
    groupedFiles,
  } = files;

  const {
    selectedFiles,
    searchTerm,
    activeFilter,
    setSearchTerm,
    setActiveFilter,
    setSelectedFiles,
    toggleFileSelection,
    toggleSelectAll,
    areFilesCompatibleForCompare,
  } = selection;

  const {
    fileInputRef,
    uploading,
    onUpload,
    onView,
    onDelete,
    onStartTranslation,
    onBatchDownload,
    onValidate,
    onCompareFiles,
  } = operations;

  const {
    isConversionSupported,
    areFilesCompatible,
    onConvert,
    onBulkConvert,
  } = conversions;

  // --- Empty state ---
  if (allFiles.length === 0) {
    return (
      <EmptyState
        title="No files uploaded"
        description="Upload your first file to get started with this project."
        primaryActionLabel="Upload File"
        onPrimaryAction={() => fileInputRef.current?.click()}
      />
    );
  }

  // --- Shared row renderer ---
  const renderFile = (file: ProjectFileDetail) => (
    <FileRowWithActions
      key={file.id}
      file={file}
      isSelected={selectedFiles.includes(file.id)}
      onSelect={() => toggleFileSelection(file.id)}
      onView={onView}
      onRetry={onStartTranslation}
      onDelete={onDelete}
      onValidate={onValidate}
      onConvert={onConvert}
      isConversionSupported={isConversionSupported}
    />
  );

  return (
    <>
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
                className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="flex items-center bg-black/20 rounded-lg p-1 border border-white/10">
              {["ALL", "RVT", "DWG", "PDF"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeFilter === filter
                      ? "bg-brand text-white shadow-lg"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {filter === "ALL" ? "All Files" : filter}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Batch Actions (toolbar) */}
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
                      onClick={onBatchDownload}
                      className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-brand/20 hover:text-primary"
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
                      onClick={() => onBulkConvert("pdf")}
                      className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-brand/20 hover:text-primary"
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
                      onClick={onCompareFiles}
                      disabled={selectedFiles.length !== 2}
                      className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-brand/20 hover:text-primary disabled:opacity-30"
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
                selectedFiles.length === allFiles.length &&
                allFiles.length > 0
              }
              onCheckedChange={toggleSelectAll}
              className="border-white/20 data-[state=checked]:bg-brand data-[state=checked]:border-primary"
            />
          </div>
          <div>Name</div>
          <div className="w-24 text-center">Type</div>
          <div className="w-24 text-center">Size</div>
          <div className="w-32 text-center">Status</div>
          <div className="w-40"></div>
        </div>

        {/* Grouped / Filtered Files List */}
        <div className="space-y-8">
          {activeFilter === "ALL" && groupedFiles ? (
            Object.entries(groupedFiles).map(
              ([type, typeFiles]: [string, ProjectFileDetail[]]) => {
                if (typeFiles.length === 0) return null;
                return (
                  <div key={type} className="space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-xs font-bold text-primary bg-brand-subtle px-2 py-1 rounded-md">
                        {type}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                    </div>
                    <div className="space-y-1">
                      {typeFiles.map(renderFile)}
                    </div>
                  </div>
                );
              },
            )
          ) : (
            <div className="space-y-1 animate-fade-in">
              {filteredFiles.length > 0 ? (
                filteredFiles.map(renderFile)
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No files found matching your filters.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <div
          className={`bg-card border border-border border-dashed border-2 border-white/10 rounded-lg p-8 text-center transition-all duration-300 group ${uploading ? "bg-primary/5 border-primary/30" : "hover:bg-white/5 hover:border-primary/30"}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              onUpload({
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

      {/* Bulk Actions Bar — fixed bottom slide-in */}
      {selectedFiles.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-xl border border-primary/20 text-foreground px-6 py-4 rounded-lg shadow-md shadow-primary/20 flex items-center gap-6 z-50 animate-slide-up ring-1 ring-white/10">
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
            {/* Compare */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCompareFiles}
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

            {/* Convert to PDF */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onBulkConvert("pdf")}
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

            {/* Convert to IFC */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onBulkConvert("ifc")}
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
    </>
  );
}
