"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authService, filesService } from "@/lib/api/services";
import { Box, FolderKanban, FileText, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  const router = useRouter();
  const urn = searchParams.get("urn");
  const selectParam = searchParams.get("select");
  const selectIds = selectParam
    ? selectParam
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n))
    : undefined;

  const [token, setToken] = useState<string>("");
  const [tokenLoading, setTokenLoading] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [recentFilesLoading, setRecentFilesLoading] = useState(true);
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
      } finally {
        setTokenLoading(false);
      }
    };
    fetchToken();
  }, []);

  useEffect(() => {
    // Only fetch recent files when there is no URN in the URL
    if (urn) {
      setRecentFilesLoading(false);
      return;
    }
    const fetchRecentFiles = async () => {
      try {
        const data = await filesService.recent();
        // Only show files that have been translated (have an apsUrn)
        setRecentFiles(
          Array.isArray(data) ? data.filter((f) => !!f.apsUrn) : [],
        );
      } catch (error) {
        showError(error, user?.role, "Failed to load recent files");
      } finally {
        setRecentFilesLoading(false);
      }
    };
    fetchRecentFiles();
  }, [urn, user?.role]);

  // --- Viewer active: show a spinner while the token is still loading ---
  if (urn) {
    if (tokenLoading) {
      return (
        <div className="flex h-[calc(100vh-100px)] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }
    if (token) {
      return (
        <div className="h-[calc(100vh-100px)] w-full rounded-lg overflow-hidden border border-white/10 shadow-md relative">
          <Viewer token={token} urn={urn} selectIds={selectIds} />
        </div>
      );
    }
  }

  // --- No URN: recent files picker ---
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-4xl font-bold text-foreground tracking-tight">
          3D Viewer
        </h2>
        <p className="text-muted-foreground mt-2 text-lg">
          High-performance BIM viewer.
        </p>
      </div>

      {recentFilesLoading ? (
        // Skeleton while fetching recent files
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : recentFiles.length === 0 ? (
        // Empty state — guides the user to pick a file
        <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
          <div className="p-5 bg-brand-subtle rounded-2xl">
            <Box className="h-12 w-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">
              No files to display
            </h3>
            <p className="text-muted-foreground max-w-md">
              Open a processed file from one of your projects to view it in 3D.
              Files must be uploaded and translated before they can be viewed.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/projects">
                <FolderKanban className="mr-2 h-4 w-4" />
                Browse Projects
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/files">
                <FileText className="mr-2 h-4 w-4" />
                All Files
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        // Recent files grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentFiles.map((file) => (
            <Card
              key={file.id}
              className="bg-card border border-border hover:bg-secondary transition-all group cursor-pointer"
              onClick={() =>
                router.push(`/dashboard/viewer?urn=${file.apsUrn}`)
              }
            >
              <CardContent className="p-6 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-brand-subtle rounded-xl">
                      <Box className="h-6 w-6 text-primary" />
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
                    {file.project?.name ?? "Unknown Project"}
                  </p>
                </div>
                <Button
                  className="w-full mt-4 bg-brand-subtle hover:bg-brand text-primary hover:text-white border border-primary/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/viewer?urn=${file.apsUrn}`);
                  }}
                >
                  Open Viewer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <ViewerContent />
    </Suspense>
  );
}
