import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientOnly } from "@/components/ClientOnly";
import {
  RefreshCw,
  AlertCircle,
  FileText,
  Box,
  Layers,
  File,
} from "lucide-react";

interface FileRowProps {
  fileName: string;
  fileType: string;
  fileSize: string;
  updatedAt: string;
  status:
    | "READY"
    | "PROCESSING"
    | "FAILED"
    | "PENDING"
    | "TRANSLATING"
    | "UPLOADED"
    | string;
  lastJobError?: string;
  onRetry?: () => void;
  onView?: () => void;
  progress?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  projectName?: string;
  actions?: React.ReactNode;
}

export function FileRowComponent({
  fileName,
  fileType,
  fileSize,
  updatedAt,
  status,
  lastJobError,
  onRetry,
  onView,
  progress,
  isSelected,
  onSelect,
  projectName,
  actions,
}: FileRowProps) {
  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("rvt")) return <Box className="h-5 w-5 text-dom-blue" />;
    if (t.includes("dwg"))
      return <Layers className="h-5 w-5 text-yellow-500" />;
    if (t.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    return <File className="h-5 w-5 text-gray-400" />;
  };

  const normalizedStatus = status.toUpperCase();

  const renderStatus = () => {
    if (normalizedStatus === "READY") {
      return (
        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 cursor-help"
          title="File is ready for viewing and conversion."
        >
          Ready
        </Badge>
      );
    }

    if (normalizedStatus === "UPLOADING") {
      return (
        <div
          className="flex items-center gap-2"
          title="Upload in progress..."
        >
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 border-blue-500/20 cursor-help"
          >
            Uploading
          </Badge>
          <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />
        </div>
      );
    }

    if (
      normalizedStatus === "PROCESSING" ||
      normalizedStatus === "TRANSLATING" ||
      normalizedStatus === "PENDING" ||
      normalizedStatus === "QUEUED" ||
      normalizedStatus === "UPLOADED"
    ) {
      return (
        <div
          className="flex items-center gap-2"
          title="Processing in progress... This may take a few minutes depending on file size."
        >
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 border-blue-500/20 cursor-help"
          >
            {normalizedStatus === "QUEUED" || normalizedStatus === "PENDING"
              ? "Queued"
              : "Processing"}
          </Badge>
          {progress !== undefined && (
            <span className="text-xs text-blue-500 font-mono">{progress}%</span>
          )}
          <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />
        </div>
      );
    }

    if (normalizedStatus === "FAILED") {
      return (
        <div className="flex items-center gap-2">
          <Badge
            variant="destructive"
            className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20"
          >
            Error
          </Badge>
          {onRetry && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="h-6 w-6 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              title="Retry"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          {lastJobError && (
            <div className="group relative">
              <AlertCircle className="h-4 w-4 text-red-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                {lastJobError}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <Badge variant="secondary" className="text-gray-500">
        {status}
      </Badge>
    );
  };

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-4 bg-card dark:glass-card rounded-2xl transition-all duration-300 group relative overflow-hidden ${isSelected ? "ring-2 ring-dom-blue/20 bg-blue-50/50" : "shadow-sm hover:shadow-md hover:-translate-y-0.5"}`}
    >
      {/* Selection Highlight Bar */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-dom-blue" />
      )}

      <div
        className="w-6 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {onSelect && (
          <ClientOnly fallback={<div className="h-4 w-4" />}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect()}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 border-2 border-gray-300 rounded-md data-[state=checked]:bg-dom-blue data-[state=checked]:border-dom-blue transition-all cursor-pointer"
            />
          </ClientOnly>
        )}
      </div>

      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`p-3 rounded-xl shrink-0 ${
            fileType.toLowerCase().includes("rvt")
              ? "bg-blue-100 text-blue-600"
              : fileType.toLowerCase().includes("dwg")
                ? "bg-amber-100 text-amber-600"
                : fileType.toLowerCase().includes("pdf")
                  ? "bg-red-100 text-red-600"
                  : "bg-gray-100 text-gray-500"
          }`}
        >
          {getIcon(fileType)}
        </div>
        <div className="min-w-0 flex flex-col gap-0.5">
          <p
            className={`font-semibold text-base text-gray-800 dark:text-white truncate transition-colors ${normalizedStatus === "READY" && onView ? "cursor-pointer hover:text-dom-blue" : ""}`}
            onClick={normalizedStatus === "READY" && onView ? onView : undefined}
          >
            {fileName}
          </p>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-gray-500">
            <span>{updatedAt}</span>
            {projectName && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                  {projectName}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="w-24 text-center">
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
          {fileType}
        </span>
      </div>

      <div className="w-24 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
        {fileSize}
      </div>

      <div className="w-36 flex justify-center">{renderStatus()}</div>

      <div className="w-32 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {actions}
      </div>
    </div>
  );
}

export const FileRow = React.memo(FileRowComponent);
