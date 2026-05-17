"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authService } from "@/lib/api/services";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";
import { VersionSelector, Version } from "@/components/viewer/VersionSelector";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Autodesk Viewer SDK has no TypeScript types — any is unavoidable here
declare global {
  interface Window {
    Autodesk: any;
    THREE: any;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function CompareViewerContent() {
  const viewerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerInstanceRef = useRef<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL Params
  const urlPrimaryUrn = searchParams.get("primary");
  const urlDiffUrn = searchParams.get("diff");
  const fileId = searchParams.get("file");
  const type = searchParams.get("type") || "3d"; // '2d' or '3d'
  /** When launched from a project context, this holds the originating projectId. */
  const projectId = searchParams.get("project");

  // State
  const [versions, setVersions] = useState<Version[]>([]);
  const [primaryUrn, setPrimaryUrn] = useState<string>(urlPrimaryUrn || "");
  const [diffUrn, setDiffUrn] = useState<string>(urlDiffUrn || "");

  const [loading, setLoading] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Versions if fileId matches a real file project
  useEffect(() => {
    if (!fileId) return;

    const fetchVersions = async () => {
      try {
        // Mock versions for now if API not ready, or implement endpoint
        // Ideally: await apiClient.get(`/api/files/${fileId}/versions`)
        // Fallback to mock for Demo purposes or use current URNs
        const mockVersions: Version[] = [
          {
            id: urlPrimaryUrn || "urn:1",
            versionNumber: 2,
            timestamp: new Date().toISOString(),
          },
          {
            id: urlDiffUrn || "urn:2",
            versionNumber: 1,
            timestamp: new Date(Date.now() - 86400000).toISOString(),
          },
        ];

        // If real endpoint existed:
        // const res = await apiClient.get(`/api/files/${fileId}/versions`)
        // setVersions(res.data)

        setVersions(mockVersions);

        // Auto-select if not already set (functional form avoids stale closure)
        setPrimaryUrn((prev) => prev || (mockVersions[0]?.id ?? ""));
        setDiffUrn((prev) => prev || (mockVersions[1]?.id ?? ""));
      } catch (err) {
        logger.error("Failed to fetch versions", {
          error: (err as Error)?.message,
        });
      }
    };
    fetchVersions();
  }, [fileId, urlPrimaryUrn, urlDiffUrn]);

  // Update URL when state changes (optional, distinct from internal state)
  const handleVersionChange = (newUrn: string, isPrimary: boolean) => {
    if (isPrimary) setPrimaryUrn(newUrn);
    else setDiffUrn(newUrn);

    // Reload viewer is handled by effect dependence on urns
  };

  // 2. Initialize Viewer
  useEffect(() => {
    if (!primaryUrn || !diffUrn || !viewerRef.current) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    const cleanup = () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.finish();
        viewerInstanceRef.current = null;
        setViewerReady(false);
      }
    };

    const initViewer = async () => {
      try {
        cleanup(); // Ensure clean slate

        // Load Autodesk Viewer scripts
        if (!window.Autodesk) {
          await loadViewerScripts();
        }

        // Fetch token
        const res = await authService.token();
        const token = res.access_token;

        const options = {
          env: "AutodeskProduction",
          accessToken: token,
          isAEC: true,
        };

        if (!mounted) return;

        window.Autodesk.Viewing.Initializer(options, async () => {
          try {
            const viewer = new window.Autodesk.Viewing.GuiViewer3D(
              viewerRef.current!,
            );
            viewerInstanceRef.current = viewer;

            // Disable default toolbar to avoid clutter? Or keep it.
            const startedCode = viewer.start();
            if (startedCode > 0) {
              throw new Error("WebGL not supported");
            }

            setViewerReady(true);

            // Load Models
            const formatUrn = (urn: string) =>
              urn.startsWith("urn:") ? urn : `urn:${urn}`;
            const documentId1 = formatUrn(primaryUrn);
            const documentId2 = formatUrn(diffUrn);

            const loadModel = (
              urn: string,
              opts: Record<string, unknown> = {},
            ) => {
              return new Promise((resolve, reject) => {
                window.Autodesk.Viewing.Document.load(
                  urn,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (doc: any) => {
                    const defaultModel = doc.getRoot().getDefaultGeometry();
                    viewer
                      .loadDocumentNode(doc, defaultModel, opts)
                      .then(resolve)
                      .catch(reject);
                  },
                  reject,
                );
              });
            };

            // Load Primary
            const model1 = await loadModel(documentId1);

            // Load Secondary (Diff) with identity transform to overlay
            const model2 = await loadModel(documentId2, {
              keepCurrentModels: true,
              placementTransform: new window.THREE.Matrix4().identity(),
            });

            // Wait for geometry
            await new Promise((r) => setTimeout(r, 800));

            // Activate Extension based on Type
            if (type === "2d") {
              const pixelCompare = await viewer.loadExtension(
                "Autodesk.Viewing.PixelCompare",
              );
              if (pixelCompare) pixelCompare.compareTwoModels(model1, model2);
            } else {
              // 3D Diff
              const diffConfig = {
                primaryModels: [model1],
                diffModels: [model2],
                versionA: "2", // Labels
                versionB: "1",
                mimeType: "application/vnd.autodesk.autocad.dwg",
                diffMode: "overlay",
              };
              const diffTool = await viewer.loadExtension(
                "Autodesk.DiffTool",
                diffConfig,
              );
              if (diffTool) diffTool.activate();
            }

            if (mounted) setLoading(false);
          } catch (err: unknown) {
            if (mounted) {
              const errMsg = err instanceof Error ? err.message : String(err);
              logger.error("Viewer initialization error", { error: errMsg });
              setError(errMsg || "Failed to initialize comparison");
              setLoading(false);
            }
          }
        });
      } catch (err: unknown) {
        if (mounted) {
          logger.error("Failed to load viewer dependencies", {
            error: err instanceof Error ? err.message : String(err),
          });
          setError("Failed to load viewer dependencies");
          setLoading(false);
        }
      }
    };

    initViewer();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [primaryUrn, diffUrn, type]); // Re-run when URNs change

  const loadViewerScripts = () => {
    return new Promise((resolve, reject) => {
      if (window.Autodesk) return resolve(true);

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/style.min.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src =
        "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/viewer3D.min.js";
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Failed to load viewer script"));
      document.head.appendChild(script);
    });
  };

  const handleBack = () => {
    if (fileId) router.push(`/dashboard/files/${fileId}`);
    else router.back();
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 text-xl font-semibold mb-4">{error}</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header / Toolbar */}
      <div className="bg-background border-b border-border p-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={
              projectId
                ? () => router.push(`/dashboard/projects/${projectId}`)
                : handleBack
            }
            className="text-foreground hover:bg-secondary"
            title={projectId ? "Back to project" : "Go back"}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-foreground leading-tight">
              {projectId ? "Comparison View" : "Comparison View"}
            </h1>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold text-primary">
              {type === "2d" ? "Pixel Compare" : "Geometric Diff"}
            </span>
            {projectId && (
              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}`)}
                className="text-[10px] text-primary underline underline-offset-2 hover:no-underline w-fit mt-0.5"
              >
                ← Back to project
              </button>
            )}
          </div>

          {/* Version Selectors */}
          <div className="flex items-center gap-4 pl-6 border-l border-border">
            <VersionSelector
              label="Primary Version (V2)"
              versions={versions}
              selectedUrn={primaryUrn}
              onChange={(u) => handleVersionChange(u, true)}
              disabled={loading}
            />
            <RefreshCw
              className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`}
            />
            <VersionSelector
              label="Compare Against (V1)"
              versions={versions}
              selectedUrn={diffUrn}
              onChange={(u) => handleVersionChange(u, false)}
              disabled={loading}
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs font-mono">PROCESSING DIFFERENCES...</span>
          </div>
        )}
      </div>

      {/* Viewer Canvas */}
      <div ref={viewerRef} className="flex-1 w-full relative bg-secondary/20">
        {!viewerReady && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Initialize comparison to view results.
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompareViewerPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-background" />}>
      <CompareViewerContent />
    </Suspense>
  );
}
