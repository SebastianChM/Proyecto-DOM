"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  FileText,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ActiveConversion {
  id: string;
  fileId: string;
  fileName: string;
  format: "pdf" | "ifc";
  status: "pending" | "processing" | "completed" | "failed";
  startTime: number;
  error?: string;
  downloadUrl?: string;
  conversionId?: string;
}

interface ConversionTrackerProps {
  conversions: ActiveConversion[];
  onDismiss: (id: string) => void;
  onDownload: (conversion: ActiveConversion) => void;
  onSaveToProject: (conversion: ActiveConversion) => void;
}

export function ConversionTracker({
  conversions,
  onDismiss,
  onDownload,
  onSaveToProject,
}: ConversionTrackerProps) {
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newTimes: Record<string, number> = {};
      conversions.forEach((c) => {
        if (c.status === "pending" || c.status === "processing") {
          newTimes[c.id] = Math.floor((now - c.startTime) / 1000);
        }
      });
      setElapsedTimes(newTimes);
    }, 1000);

    return () => clearInterval(interval);
  }, [conversions]);

  const activeConversions = conversions.filter(
    (c) => c.status === "pending" || c.status === "processing",
  );
  const completedConversions = conversions.filter(
    (c) => c.status === "completed" || c.status === "failed",
  );

  if (conversions.length === 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getEstimatedTime = (format: string) => {
    // IFC conversions typically take 2-5 minutes for large files
    // PDF conversions are usually faster (30s-2min)
    return format === "ifc" ? "2-5 min" : "30s-2 min";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {/* Active Conversions */}
      {activeConversions.map((conversion) => (
        <div
          key={conversion.id}
          className="bg-gray-900/95 backdrop-blur-xl text-white p-4 rounded-xl shadow-md border border-white/10 animate-in slide-in-from-right-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">
                  Converting to {conversion.format.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatTime(elapsedTimes[conversion.id] || 0)}
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {conversion.fileName}
              </p>
              <div className="mt-2">
                <Progress value={undefined} className="h-1 bg-gray-700" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Estimated time: {getEstimatedTime(conversion.format)}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Completed Conversions */}
      {completedConversions.map((conversion) => (
        <div
          key={conversion.id}
          className={cn(
            "backdrop-blur-xl text-white p-4 rounded-xl shadow-md border animate-in slide-in-from-right-5",
            conversion.status === "completed"
              ? "bg-green-900/90 border-green-500/30"
              : "bg-red-900/90 border-red-500/30",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {conversion.status === "completed" ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">
                  {conversion.status === "completed"
                    ? `${conversion.format.toUpperCase()} Ready!`
                    : "Conversion Failed"}
                </span>
                <button
                  onClick={() => onDismiss(conversion.id)}
                  className="text-gray-400 hover:text-white p-0.5"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-300 truncate mt-0.5">
                {conversion.fileName}
              </p>

              {conversion.status === "completed" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => onDownload(conversion)}
                    className="h-7 text-xs bg-white text-gray-900 hover:bg-gray-200"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSaveToProject(conversion)}
                    className="h-7 text-xs border-white/30 text-white hover:bg-white/10"
                  >
                    {conversion.format === "ifc" ? (
                      <Box className="h-3 w-3 mr-1" />
                    ) : (
                      <FileText className="h-3 w-3 mr-1" />
                    )}
                    Save to Project
                  </Button>
                </div>
              )}

              {conversion.status === "failed" && conversion.error && (
                <p className="text-xs text-red-300 mt-2">{conversion.error}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
