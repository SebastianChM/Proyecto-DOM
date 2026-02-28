"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { filesService } from "@/lib/api/services";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import {} from "sonner";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Dynamically import Viewer to avoid SSR issues
const Viewer = dynamic(() => import("@/components/Viewer"), { ssr: false });

interface FileData {
  id: string;
  name: string;
  apsUrn?: string | null;
  projectId?: string;
  status: string;
  type: string;
}

export default function ViewerPage() {
  const params = useParams();
  const { user } = useUser();
  const fileId = params.id as string;

  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const data = await filesService.get(fileId);
        setFile(data);
      } catch (error) {
        showError(error, user?.role, "Failed to load file details");
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchFile();
    }
  }, [fileId, user?.role]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-dom-blue/30 border-t-dom-blue rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-dom-blue/20 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-lg font-medium animate-pulse text-muted-foreground">
            Loading Viewer...
          </p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="glass-card p-8 rounded-2xl text-center max-w-md border border-border">
          <h2 className="text-2xl font-bold mb-2 text-foreground">
            File Not Found
          </h2>
          <p className="text-muted-foreground mb-6">
            The requested file could not be located.
          </p>
          <Link href="/dashboard">
            <Button className="w-full bg-dom-blue hover:bg-dom-blue-dark text-white">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (file.status !== "READY" || !file.apsUrn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="glass-card p-8 rounded-2xl text-center max-w-md border-l-4 border-yellow-500 shadow-lg border-y border-r border-border">
          <h2 className="text-xl font-bold mb-4 text-foreground">
            File Not Ready
          </h2>
          <div className="bg-secondary rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-muted-foreground mb-2">Status</p>
            <p className="font-mono text-yellow-600 dark:text-yellow-400 font-bold">
              {file.status}
            </p>
          </div>
          <p className="text-muted-foreground mb-6 text-sm">
            {file.status === "TRANSLATING" &&
              "The file is currently being processed. This usually takes a few minutes."}
            {file.status === "UPLOADED" &&
              "The file is uploaded but processing hasn't started."}
            {file.status === "FAILED" &&
              "Processing failed. Please try uploading the file again."}
          </p>
          <Link href={`/dashboard/projects/${file.projectId}`}>
            <Button
              variant="outline"
              className="w-full border-border hover:bg-secondary text-foreground"
            >
              Return to Project
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden group">
      {/* Floating Header - Auto-hides */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-4 transition-opacity duration-300 opacity-100 group-hover:opacity-100">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/dashboard/projects/${file.projectId}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-button rounded-full h-12 w-12 text-foreground bg-background/50 hover:bg-background/80 hover:scale-110 transition-all shadow-lg border border-border"
                >
                  <ArrowLeft className="h-6 w-6" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-popover border-border text-popover-foreground"
            >
              <p>Back to Project</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="glass-panel px-6 py-2.5 rounded-full flex items-center gap-4 shadow-2xl backdrop-blur-xl border-border animate-in slide-in-from-top-4 duration-500 bg-background/80">
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            {file.name}
          </h1>
          <div className="h-4 w-px bg-border"></div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {file.type.toLowerCase().includes("pdf")
              ? "PDF Document"
              : "3D Model"}
          </span>
        </div>
      </div>

      {/* Floating Controls (Top Right) */}
      <div className="absolute top-6 right-6 z-50 transition-opacity duration-300 opacity-100 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="glass-button text-foreground bg-background/50 hover:bg-background/80 gap-2 rounded-full px-4 h-10 shadow-lg border border-border"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Exit Fullscreen</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </>
          )}
        </Button>
      </div>

      {/* Viewer Area */}
      <div className="w-full h-full bg-secondary/20">
        {file.type.toLowerCase().includes("pdf") ? (
          <iframe
            src={`/api/files/${file.id}/download`}
            className="w-full h-full border-none bg-white"
            title="PDF Viewer"
          />
        ) : (
          <Viewer urn={file.apsUrn} />
        )}
      </div>
    </div>
  );
}
