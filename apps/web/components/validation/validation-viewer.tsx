import { useState } from "react";
import { logger } from "@/lib/logger";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Viewer from "@/components/Viewer";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-simple";
import { FileText, Database } from "lucide-react";

import dynamic from "next/dynamic";

const SimplePdfViewer = dynamic(
  () =>
    import("@/components/pdf/SimplePdfViewer").then(
      (mod) => mod.SimplePdfViewer,
    ),
  {
    ssr: false,
    loading: () => <div className="p-4">Loading PDF Engine...</div>,
  },
);

interface Incident {
  id: string;
  requirementId: string;
  elementId: number;
  elementName: string;
  description: string;
  severity: string;
  status: string;
}

interface ValidationViewerProps {
  data: {
    stats: {
      requirementsChecked: number;
      elementsScanned: number;
      incidentsFound: number;
      durationMs: number;
    };
    incidents: Incident[];
    checklist?: Array<{
      id: string;
      description: string;
      category: string;
      page?: number;
      originalText?: string;
      text?: string;
    }>;
    scannedElements?: Array<{
      id: number;
      name: string;
      category: string;
    }>;
    modelUrn: string;
  };
  files: { spec: File | null; norm: File | null; specUrl?: string | null };
}

export function ValidationViewer({ data, files }: ValidationViewerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewerInstance, setViewerInstance] = useState<any | null>(null);
  const [pdfHighlight, setPdfHighlight] = useState<{
    page: number;
    text: string;
  } | null>(null);

  const handleIncidentClick = (incident: Incident) => {
    logger.debug("ValidationViewer: Incident clicked", {
      id: incident.id,
      elementId: incident.elementId,
    });

    if (!viewerInstance) {
      logger.error("ValidationViewer: No Viewer Instance found");
      // return; // Don't return, allow PDF sync even if 3D fails
    } else {
      // 1. Isolate in 3D Viewer
      const dbId = Number(incident.elementId);
      logger.debug("ValidationViewer: Isolating DBID", {
        dbId,
        type: typeof dbId,
      });

      if (!isNaN(dbId)) {
        try {
          viewerInstance.isolate([dbId]);
          viewerInstance.fitToView([dbId]);

          // Colors
          viewerInstance.clearThemingColors();

          const winWithViewer = window as unknown as {
            THREE?: { Vector4: new (...args: number[]) => unknown };
            Autodesk?: {
              Viewing?: {
                THREE?: { Vector4: new (...args: number[]) => unknown };
              };
            };
          };
          const THREE =
            winWithViewer.THREE || winWithViewer.Autodesk?.Viewing?.THREE;
          if (THREE) {
            const color =
              incident.severity === "CRITICAL"
                ? new THREE.Vector4(1, 0, 0, 0.5)
                : new THREE.Vector4(1, 1, 0, 0.5);
            viewerInstance.setThemingColor(dbId, color);
          }
        } catch (err) {
          logger.error("ValidationViewer: Viewer API Exception", {
            error: (err as Error)?.message,
          });
        }
      } else {
        logger.error("ValidationViewer: Invalid DBID (NaN)");
      }
    }

    // 2. Sync PDF Viewer (Jump & Highlight)
    if (data.checklist) {
      const req = data.checklist.find((r) => r.id === incident.requirementId);
      logger.debug("ValidationViewer: Linked Requirement", { reqId: req?.id });

      if (req && req.page) {
        const searchText = req.originalText
          ? req.originalText.trim()
          : (req.text || "").trim();
        logger.debug("ValidationViewer: Setting PDF Highlight", {
          page: req.page,
          text: searchText,
        });

        setPdfHighlight({
          page: req.page,
          text: searchText,
        });
      } else {
        logger.warn("ValidationViewer: No Page info in requirement");
      }
    }
  };

  const handleViewerInitialized = (viewer: unknown) => {
    setViewerInstance(viewer);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 h-full">
      {/* Left Panel: Incidents List */}
      <Card className="lg:col-span-2 h-full flex flex-col border-destructive/20 shadow-md">
        <CardHeader className="flex flex-col space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="text-destructive h-5 w-5" />
              Incidents Found
            </CardTitle>
            <Badge variant="destructive">
              {data.stats?.incidentsFound || 0}
            </Badge>
          </div>

          {/* Simple Filter Tabs */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              All
            </Badge>
            <Badge
              variant="destructive"
              className="cursor-pointer hover:bg-red-600"
            >
              Critical
            </Badge>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-yellow-200"
            >
              Warning
            </Badge>
          </div>

          {data.stats && (
            <div className="flex flex-col gap-2">
              <CardDescription className="text-xs">
                Scanned {data.stats.elementsScanned} elements against{" "}
                {data.stats.requirementsChecked} requirements.
              </CardDescription>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs w-full"
                  >
                    View Scan Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Validation Details</DialogTitle>
                  </DialogHeader>
                  <Tabs
                    defaultValue="requirements"
                    className="flex-1 overflow-hidden flex flex-col"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="requirements">
                        <FileText className="mr-2 h-4 w-4" />
                        Requirements
                      </TabsTrigger>
                      <TabsTrigger value="elements">
                        <Database className="mr-2 h-4 w-4" />
                        Elements
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="requirements"
                      className="flex-1 overflow-auto mt-2 border rounded-md p-2"
                    >
                      <ScrollArea className="h-[400px]">
                        {data.checklist?.map((req, i) => (
                          <div
                            key={i}
                            className="mb-2 p-2 border-b last:border-0 text-sm"
                          >
                            <div className="font-semibold text-xs text-muted-foreground">
                              {req.category}
                            </div>
                            <div>{req.description}</div>
                          </div>
                        ))}
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent
                      value="elements"
                      className="flex-1 overflow-auto mt-2 border rounded-md p-2"
                    >
                      <ScrollArea className="h-[400px]">
                        {data.scannedElements?.map((el) => (
                          <div
                            key={el.id}
                            className="grid grid-cols-3 gap-2 text-xs py-1 border-b last:border-0"
                          >
                            <div className="font-mono">{el.id}</div>
                            <div className="truncate" title={el.name}>
                              {el.name}
                            </div>
                            <div className="truncate">{el.category}</div>
                          </div>
                        ))}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-360px)]">
            <div className="divide-y divide-border/50">
              {!data.incidents || data.incidents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                  <p>No incidents found.</p>
                </div>
              ) : (
                data.incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 hover:bg-muted/50 transition-colors cursor-pointer border-l-4 border-l-transparent hover:border-l-destructive"
                    onClick={() => handleIncidentClick(incident)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <Badge
                        variant={
                          incident.severity === "CRITICAL"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px] px-1 py-0 h-5"
                      >
                        {incident.severity}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        ID: {incident.elementId}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1">
                      {incident.elementName}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-snug">
                      {incident.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Panel: 3D Viewer */}
      <Card className="lg:col-span-5 h-full flex flex-col border-muted shadow-sm">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Model Verification View</span>
            <div className="text-xs font-normal text-muted-foreground">
              URN:{" "}
              {data.modelUrn ? data.modelUrn.substring(0, 20) + "..." : "None"}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 bg-neutral-900 relative rounded-b-lg overflow-hidden p-0 min-h-[500px]">
          {data.modelUrn ? (
            <Viewer
              urn={data.modelUrn}
              onViewerInitialized={handleViewerInitialized}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <p>No Model URN provided</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Panel */}
      <Card className="lg:col-span-5 h-full flex flex-col border-muted shadow-sm">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-base">Technical Specifications</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden bg-gray-50 dark:bg-neutral-900">
          <SimplePdfViewer
            file={files?.spec || files?.norm}
            fileUrl={files?.specUrl}
            highlight={pdfHighlight}
          />
        </CardContent>
      </Card>
    </div>
  );
}
