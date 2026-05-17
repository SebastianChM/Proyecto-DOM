"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { authService } from "@/lib/api/services";
import { isMockUrn } from "@/lib/utils";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { useUser } from "@/context/UserContext";
import apiClient from "@/lib/axios-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface ViewerProps {
  urn: string;
  token?: string;
  fileId?: string;
  fileStatus?: string;
  /** APS dbIds to select and zoom to after model loads (for compliance issue highlighting) */
  selectIds?: number[];
  onViewerInitialized?: (viewer: any) => void;
}

declare global {
  interface Window {
    Autodesk: any;
  }
}

export default function Viewer({
  urn,
  token: providedToken,
  fileId,
  fileStatus,
  selectIds,
  onViewerInitialized,
}: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const origWarnRef = useRef<((...args: any[]) => void) | null>(null);
  const retriedTranslationRef = useRef(false);
  const selectIdsRef = useRef<number[] | undefined>(selectIds);
  const { user } = useUser();
  const [viewerError, setViewerError] = useState<string | null>(null);

  // Keep ref in sync so the model-loaded callback has the latest value
  useEffect(() => {
    selectIdsRef.current = selectIds;
  }, [selectIds]);

  const retryTranslation = async () => {
    if (!fileId || retriedTranslationRef.current) return;
    retriedTranslationRef.current = true;

    const status = (fileStatus || "").toUpperCase();
    if (status !== "READY") {
      setViewerError(
        "Model has no geometry and is not in READY state. Open file details and retry processing manually.",
      );
      return;
    }

    const retryKey = `viewer-retry:${fileId}`;
    const lastRetryRaw = window.localStorage.getItem(retryKey);
    const lastRetry = lastRetryRaw ? Number(lastRetryRaw) : 0;
    const retryCooldownMs = 5 * 60 * 1000;
    if (Date.now() - lastRetry < retryCooldownMs) {
      setViewerError(
        "Automatic retry was recently requested. Please wait a few minutes before retrying again.",
      );
      return;
    }

    try {
      await apiClient.post(`/api/translation/${fileId}/translate?force=true`);
      window.localStorage.setItem(retryKey, String(Date.now()));
      setViewerError(
        "Model translation is being retried. Wait a moment and reopen the viewer.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setViewerError(`Failed to retry translation: ${message}`);
    }
  };

  // Hooks must be called before any early return
  useEffect(() => {
    if (isMockUrn(urn)) return; // Skip if mock

    const loadViewer = async () => {
      if (!window.Autodesk) {
        // Load APS Viewer scripts dynamically if not present
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src =
          "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
        script.onload = initializeViewer;
        document.body.appendChild(script);
      } else {
        initializeViewer();
      }
    };

    const loadModel = (viewerInstance: any, modelUrn: string) => {
      setViewerError(null);
      const documentId = "urn:" + modelUrn;
      window.Autodesk.Viewing.Document.load(
        documentId,
        (doc: any) => {
          const root = doc?.getRoot?.();
          const defaultModel = root?.getDefaultGeometry?.();
          const geometryNodes =
            window.Autodesk?.Viewing?.Document?.getSubItemsWithProperties?.(
              root,
              { type: "geometry" },
              true,
            ) ?? [];
          const targetNode = defaultModel ?? geometryNodes[0];

          if (!targetNode) {
            const message = "No geometry node found in model manifest";
            setViewerError(message);
            showError(new Error(message), user?.role, "Model Loading Failed");
            retryTranslation().catch(() => {
              // noop
            });
            return;
          }

          const maybePromise = viewerInstance.loadDocumentNode(doc, targetNode);
          if (maybePromise?.catch) {
            maybePromise.catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              setViewerError(message);
              showError(
                err instanceof Error ? err : new Error(message),
                user?.role,
                "Model Loading Failed",
              );
            });
          }
        },
        (errorCode: any, errorMsg: any) => {
          const errorDetails = {
            code: errorCode || "UNKNOWN_CODE",
            message: errorMsg || "Unknown error",
            urn: modelUrn,
          };
          setViewerError(
            `Viewer Load Error: ${errorDetails.code} - ${errorDetails.message}`,
          );
          showError(
            new Error(
              `Viewer Load Error: ${errorDetails.code} - ${errorDetails.message}`,
            ),
            user?.role,
            "Model Loading Failed",
          );
        },
      );
    };

    const initializeViewer = async () => {
      try {
        let token = providedToken;

        if (!token) {
          const data = await authService.token();
          token = data.access_token;
        }

        const options = {
          env: "AutodeskProduction",
          accessToken: token,
          isAEC: true,
          logLevel: 3, // ERROR only — suppress cosmetic texture warnings
        };

        // Filter known cosmetic texture warnings from the Autodesk viewer
        const origWarn = console.warn;
        origWarnRef.current = origWarn;
        const textureWarningPatterns = [
          /texture/i,
          /material.*not.*found/i,
          /power of two/i,
          /image.*decode/i,
        ];
        console.warn = (...args: any[]) => {
          const msg = args.join(" ");
          if (textureWarningPatterns.some((p) => p.test(msg))) return;
          origWarn.apply(console, args);
        };

        window.Autodesk.Viewing.Initializer(options, () => {
          // Avoid noisy third-party analytics calls in environments with
          // tracking blockers enabled (does not affect model loading).
          window.Autodesk?.Viewing?.Private?.analytics?.optOut?.(true);

          if (containerRef.current) {
            // Prevent double initialization
            if (viewerRef.current) return;

            const newViewer = new window.Autodesk.Viewing.GuiViewer3D(
              containerRef.current,
            );
            newViewer.start();
            newViewer.loadExtension("Autodesk.Measure");
            viewerRef.current = newViewer;

            if (onViewerInitialized) {
              onViewerInitialized(newViewer);
            }

            // Register model-loaded handler to select/highlight requested elements
            newViewer.addEventListener(
              window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
              () => {
                const ids = selectIdsRef.current;
                if (ids && ids.length > 0) {
                  newViewer.select(ids);
                  newViewer.fitToView(ids);
                }
              },
              { once: true },
            );

            loadModel(newViewer, urn);
          }
        });
      } catch (error) {
        logger.error("Viewer initialization failed", {
          error: error instanceof Error ? error.message : String(error),
          urn: urn,
          hasToken: !!providedToken,
        });
        showError(error, user?.role, "Viewer Initialization Failed");
      }
    };

    loadViewer();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
      }
      if (origWarnRef.current) {
        console.warn = origWarnRef.current;
        origWarnRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn, user?.role]);

  // Professional handling of Mock/Simulation Data
  if (isMockUrn(urn)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 p-6">
        <Card className="max-w-md w-full border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
              <AlertCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Simulation Mode (Test File)</CardTitle>
            <CardDescription>
              This is a generated test file with no visual data.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground space-y-4">
            <p>
              To see the real 2D/3D Viewer, please{" "}
              <strong>upload your real .DWG file</strong> using the &quot;Upload
              File&quot; button in the dashboard.
            </p>
            <div className="bg-muted p-3 rounded text-xs font-mono">
              URN: {urn}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black">
      {viewerError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
          <Card className="max-w-lg w-full border-white/20 bg-gray-900 text-white">
            <CardHeader>
              <CardTitle>Model Loading Failed</CardTitle>
              <CardDescription className="text-gray-300">
                {viewerError}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-300">
              If this file was marked as ready without geometry, translation
              retry has been requested automatically.
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
