"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from "react";
import { authService } from "@/lib/api/services";
import { isMockUrn } from "@/lib/utils";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { useUser } from "@/context/UserContext";
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
  onViewerInitialized,
}: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const origWarnRef = useRef<((...args: any[]) => void) | null>(null);
  const { user } = useUser();

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
      const documentId = "urn:" + modelUrn;
      window.Autodesk.Viewing.Document.load(
        documentId,
        (doc: any) => {
          const defaultModel = doc.getRoot().getDefaultGeometry();
          viewerInstance.loadDocumentNode(doc, defaultModel);
        },
        (errorCode: any, errorMsg: any) => {
          const errorDetails = {
            code: errorCode || "UNKNOWN_CODE",
            message: errorMsg || "Unknown error",
            urn: modelUrn,
          };
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

  return <div ref={containerRef} className="w-full h-full relative" />;
}
