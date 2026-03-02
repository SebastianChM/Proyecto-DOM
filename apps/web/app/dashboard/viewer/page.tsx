"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authService, filesService } from "@/lib/api/services";
import { Box, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Viewer from "@/components/Viewer";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

interface RecentFile {
  id: string;
  type: string;
  name: string;
  project?: { name: string };
  apsUrn?: string | null;
}

function ViewerContent() {
  const searchParams = useSearchParams();
  const urn = searchParams.get("urn");
  const [token, setToken] = useState<string>("");
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const { user } = useUser();

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const data = await authService.token();
        setToken(data.access_token);
      } catch (error) {
        logger.error("Failed to fetch viewer token", {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    };
    fetchToken();
  }, []);

  useEffect(() => {
    if (!urn) {
      const fetchRecentFiles = async () => {
        try {
          const data = await filesService.recent();
          setRecentFiles(Array.isArray(data) ? data : []);
        } catch (error) {
          showError(error, user?.role, "Failed to load recent files");
        }
      };
      fetchRecentFiles();
    }
  }, [urn, user?.role]);

  if (urn && token) {
    return (
      <div className="h-[calc(100vh-100px)] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative">
        <Viewer token={token} urn={urn} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in h-full">
      <div>
        <h2 className="text-4xl font-bold text-foreground tracking-tight">
          3D Viewer
        </h2>
        <p className="text-muted-foreground mt-2 text-lg">
          High-performance BIM viewer.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <Card className="glass-panel border-dashed border-2 border-border hover:border-dom-blue/50 transition-all cursor-pointer group h-64 flex items-center justify-center">
          <CardContent className="text-center">
            <div className="bg-secondary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Upload className="h-8 w-8 text-dom-blue" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Quick View
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Upload a file to view instantly without saving to a project.
            </p>
            <Button
              variant="outline"
              className="glass-button border-border hover:bg-secondary"
            >
              Select File
            </Button>
          </CardContent>
        </Card>

        {/* Recent Files Selection */}
        {recentFiles.map((file) => (
          <Card
            key={file.id}
            className="glass-panel hover:bg-secondary transition-all group border-border"
          >
            <CardContent className="p-6 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-dom-blue/10 rounded-xl">
                    <Box className="h-6 w-6 text-dom-blue" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded border border-border">
                    {file.type}
                  </span>
                </div>
                <h3
                  className="text-lg font-bold text-foreground mb-1 truncate"
                  title={file.name}
                >
                  {file.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {file.project?.name || "Unknown Project"}
                </p>
              </div>
              <Button
                className="w-full mt-4 bg-dom-blue/10 hover:bg-dom-blue text-dom-blue hover:text-white border border-dom-blue/20"
                onClick={() =>
                  (window.location.href = `/dashboard/viewer?urn=${file.apsUrn}`)
                }
              >
                Open Viewer <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          Loading Viewer...
        </div>
      }
    >
      <ViewerContent />
    </Suspense>
  );
}
