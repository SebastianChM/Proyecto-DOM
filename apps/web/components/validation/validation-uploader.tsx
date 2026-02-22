"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  AlertCircle,
  Loader2,
  Database,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Upload,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/axios-config";
import { logger } from "@/lib/logger";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs-simple";
import { ModelSelector } from "@/components/validation/model-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_CONFIG } from "@/lib/config";

// Shared Interfaces
export interface Incident {
  id: string;
  requirementId: string;
  elementId: number;
  elementName: string;
  description: string;
  severity: string;
  status: string;
}

export interface Requirement {
  id: string;
  derivedCategory?: string;
  originalText?: string;
  text?: string;
  [key: string]: unknown;
}

export interface ViewerRequirement {
  id: string;
  description: string;
  category: string;
  page?: number;
  originalText?: string;
  text?: string;
}

export interface ValidationData {
  stats: {
    requirementsChecked: number;
    elementsScanned: number;
    incidentsFound: number;
    durationMs: number;
  };
  incidents: Incident[];
  checklist?: ViewerRequirement[];
  scannedElements?: Array<{
    id: number;
    name: string;
    category: string;
  }>;
  modelUrn: string;
}

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  status: string;
  size: number;
}

interface ValidationUploaderProps {
  onUploadComplete: (
    data: ValidationData,
    files: { spec: File | null; norm: File | null; specUrl?: string | null },
  ) => void;
}

export function ValidationUploader({
  onUploadComplete,
}: ValidationUploaderProps) {
  // --- State ---
  const [file, setFile] = useState<File | null>(null);
  const [normativeFile, setNormativeFile] = useState<File | null>(null);
  const [modelUrn, setModelUrn] = useState<string>("");
  const [selectedModelName, setSelectedModelName] = useState<string>("");

  // PDF Source Selection
  const [pdfSource, setPdfSource] = useState<"upload" | "project">("upload");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [selectedPdfId, setSelectedPdfId] = useState<string>("");
  const [loadingProjectFiles, setLoadingProjectFiles] = useState(false);

  // Workflow State
  const [step, setStep] = useState<"upload" | "review" | "verifying">("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive Audit Data
  const [extractedRequirements, setExtractedRequirements] = useState<
    Requirement[]
  >([]);
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

  // Model Status Check
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [modelStatus, setModelStatus] = useState<
    "unknown" | "success" | "processing" | "failed"
  >("unknown");
  const [failReason, setFailReason] = useState<string>("");

  const [activeTab, setActiveTab] = useState("browse");
  const [discipline, setDiscipline] = useState("ALL");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch project files when project is selected
  const fetchProjectFiles = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setLoadingProjectFiles(true);
    try {
      const res = await apiClient.get(`/api/files/project/${projectId}`);
      // Filter only PDF files that are READY
      const pdfFiles = res.data.filter(
        (f: ProjectFile) => f.type === "PDF" && f.status === "READY",
      );
      setProjectFiles(pdfFiles);
    } catch (err) {
      logger.error("Failed to fetch project files", {
        error: (err as Error)?.message,
      });
      setProjectFiles([]);
    } finally {
      setLoadingProjectFiles(false);
    }
  }, []);

  // When project is selected from ModelSelector, also fetch its files
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectFiles(selectedProjectId);
    }
  }, [selectedProjectId, fetchProjectFiles]);

  // Auto-check model status when URN changes
  useEffect(() => {
    if (!modelUrn) {
      setModelStatus("unknown");
      setFailReason("");
      return;
    }

    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const res = await apiClient.get(
          `/api/compliance/model-status?urn=${modelUrn}`,
        );
        const status = res.data.status;

        if (status === "success") {
          setModelStatus("success");
          setFailReason("");
        } else if (status === "inprogress" || status === "pending") {
          setModelStatus("processing");
        } else {
          setModelStatus("failed"); // failed or timeout
          if (res.data.messages && res.data.messages.length > 0) {
            setFailReason(
              res.data.messages[0].type + ": " + res.data.messages[0].message,
            );
          } else {
            setFailReason("Autodesk Translation Failed (Unknown Reason)");
          }
        }
      } catch (err) {
        logger.error("Status check failed", { error: (err as Error)?.message });
        setModelStatus("unknown");
      } finally {
        setCheckingStatus(false);
      }
    };

    const timer = setTimeout(checkStatus, 500);
    return () => clearTimeout(timer);
  }, [modelUrn]);

  if (!isMounted) return null;

  // --- Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleModelSelect = (urn: string, name: string, projectId?: string) => {
    setModelUrn(urn);
    setSelectedModelName(name);
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  };

  // Toggle specific requirement
  const toggleReq = (id: string) => {
    const next = new Set(selectedReqIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedReqIds(next);
  };

  // Toggle All
  const toggleAll = (select: boolean) => {
    if (select) {
      setSelectedReqIds(new Set(extractedRequirements.map((r) => r.id)));
    } else {
      setSelectedReqIds(new Set());
    }
  };

  // Step 1: Analyze Document
  const handleAnalyze = async () => {
    // Check if we have a file source based on selection mode
    const hasFile = pdfSource === "upload" ? !!file : !!selectedPdfId;
    if (!hasFile) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();

      if (pdfSource === "upload" && file) {
        formData.append("file", file);
      } else if (pdfSource === "project" && selectedPdfId) {
        // For project files, we send the file ID and let the server fetch it
        formData.append("projectFileId", selectedPdfId);
      }

      if (normativeFile) {
        formData.append("normativeFile", normativeFile);
      }

      // Call Analyze Endpoint
      const res = await apiClient.post(
        "/api/compliance/analyze/spec",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      if (res.data && res.data.data) {
        const reqs = res.data.data;
        setExtractedRequirements(reqs);
        // Default: Select All
        setSelectedReqIds(new Set(reqs.map((r: Requirement) => r.id)));
        setStep("review");
        toast.success("Document Analyzed", {
          description: `Found ${reqs.length} potential requirements.`,
        });
      }
    } catch (err: unknown) {
      logger.error("Analysis failed", { error: (err as Error)?.message });
      setError(
        "Failed to analyze document. Ensure it's a valid PDF/Text file.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Selected Parameters
  const handleVerifyParams = async () => {
    if (!modelUrn) return;
    setLoading(true);
    setStep("verifying");

    try {
      // Filter requirements
      const finalChecklist = extractedRequirements.filter((r) =>
        selectedReqIds.has(r.id),
      );

      const res = await apiClient.post("/api/compliance/verify", {
        urn: modelUrn,
        checklist: JSON.stringify(finalChecklist),
        discipline: discipline,
      });

      // Generate specUrl for project PDFs
      const specUrl =
        pdfSource === "project" && selectedPdfId
          ? `${API_CONFIG.BASE_URL}/api/files/${selectedPdfId}/download`
          : null;

      onUploadComplete(
        {
          ...res.data,
          modelUrn: modelUrn,
        },
        { spec: file, norm: normativeFile, specUrl },
      );

      toast.success("Verification Complete", {
        description: `Checked ${finalChecklist.length} selected rules.`,
      });

      setStep("upload");
    } catch (error: unknown) {
      logger.error("Verification failed", { error: (error as Error)?.message });

      const axiosErr = error as { response?: { data?: { error?: string } } };
      const msg =
        axiosErr.response?.data?.error ||
        (error as Error).message ||
        "Verification Failed";
      setError(msg);
      setStep("review"); // Return to review to retry
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---

  return (
    <div className="grid gap-6 max-w-md">
      {/* STEP 1: UPLOAD & CONFIG */}
      {step === "upload" && (
        <>
          <div className="grid gap-2">
            <Label>BIM Model Source</Label>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="browse">
                  <Database className="w-4 h-4 mr-2" />
                  Browse Project
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Manual URN
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 p-4 border rounded-md bg-card/50">
                <TabsContent value="browse" className="mt-0">
                  <ModelSelector onModelSelect={handleModelSelect} />
                </TabsContent>

                <TabsContent value="manual" className="mt-0">
                  <div className="grid gap-2">
                    <Label htmlFor="urn" className="text-xs">
                      Paste Autodesk URN
                    </Label>
                    <Input
                      id="urn"
                      placeholder="dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6..."
                      value={modelUrn}
                      onChange={(e) => setModelUrn(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Base64 Encoded URN from Model Derivative API.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Status Indicators (Model) */}
          {modelUrn && activeTab === "browse" ? (
            <div className="flex items-center gap-2 p-2 bg-accent/50 border rounded-md text-sm">
              <Database className="w-4 h-4 text-primary" />
              <span className="font-medium truncate flex-1">
                {selectedModelName || "Model Selected"}
              </span>
              {checkingStatus ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : modelStatus === "success" ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive" />
              )}
            </div>
          ) : null}

          {/* PROACTIVE WARNING IF MODEL FAILED */}
          {modelStatus === "failed" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Incompatible Model</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Autodesk failed to process this file. <br />
                <strong>Possible Reason:</strong>{" "}
                {failReason || "Unsupported Format"}. <br />
                <span className="italic block mt-1">
                  Please select a 3D Model (RVT/IFC/NWC). 2D Drawings (DWG) are
                  often incompatible with property extraction.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Discipline Selection */}
          <div className="grid gap-2">
            <Label htmlFor="discipline-select">Specialty / Discipline</Label>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger
                id="discipline-select"
                aria-label="Select Discipline"
              >
                <SelectValue placeholder="Select Discipline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Disciplines</SelectItem>
                <SelectItem value="STRUCTURAL">Structural</SelectItem>
                <SelectItem value="MEP">MEP</SelectItem>
                <SelectItem value="ARCHITECTURAL">Architectural</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Specification Document (Technical Specs)</Label>
            <Tabs
              value={pdfSource}
              onValueChange={(v) => setPdfSource(v as "upload" | "project")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload New
                </TabsTrigger>
                <TabsTrigger value="project">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  From Project
                </TabsTrigger>
              </TabsList>

              <div className="mt-3 p-3 border rounded-md bg-card/50">
                <TabsContent value="upload" className="mt-0">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                  />
                </TabsContent>

                <TabsContent value="project" className="mt-0">
                  {projectFiles.length > 0 ? (
                    <Select
                      value={selectedPdfId}
                      onValueChange={setSelectedPdfId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a PDF from project..." />
                      </SelectTrigger>
                      <SelectContent>
                        {projectFiles.map((pf) => (
                          <SelectItem key={pf.id} value={pf.id}>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span className="truncate">{pf.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({(pf.size / (1024 * 1024)).toFixed(1)} MB)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : loadingProjectFiles ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading project PDFs...
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedProjectId
                        ? "No PDFs found in this project. Upload one from the Files tab."
                        : "Select a project above to see available PDFs."}
                    </p>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="normative-file">
              Normative Reference (Optional)
            </Label>
            <div className="flex flex-col gap-1.5">
              <Input
                id="normative-file"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files?.[0]) setNormativeFile(e.target.files[0]);
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                E.g. Building Code, Seismic Regulation. If conflicts arise, this
                document overrides the Specs.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={
              (pdfSource === "upload" ? !file : !selectedPdfId) ||
              !modelUrn ||
              loading ||
              modelStatus !== "success"
            }
            className="w-full"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {loading ? "Analyzing..." : "Analyze Document"}
          </Button>

          {/* Helper Text for Disabled State */}
          {(pdfSource === "upload" ? !file : !selectedPdfId) && modelUrn && (
            <p className="text-xs text-center text-destructive">
              Specification Document is required.
            </p>
          )}
          {(pdfSource === "upload" ? file : selectedPdfId) && !modelUrn && (
            <p className="text-xs text-center text-muted-foreground">
              Please select a BIM Model above.
            </p>
          )}
          {(pdfSource === "upload" ? file : selectedPdfId) &&
            modelUrn &&
            modelStatus !== "success" && (
              <p className="text-xs text-center text-destructive">
                Model is not ready for analysis (Status: {modelStatus}).
              </p>
            )}
        </>
      )}

      {/* STEP 2: REVIEW PARAMETERS */}
      {step === "review" && (
        <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Review Parameters</h3>
            <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
              Back
            </Button>
          </div>

          <div className="bg-muted/30 p-3 rounded-md border text-sm flex justify-between items-center">
            <span>
              Found <strong>{extractedRequirements.length}</strong> rules.
            </span>
            <div className="space-x-2">
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => toggleAll(true)}
              >
                Select All
              </Button>
              <Button
                variant="link"
                className="h-auto p-0 text-xs text-destructive"
                onClick={() => toggleAll(false)}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="h-[300px] overflow-y-auto border rounded-md p-2 space-y-2 bg-background">
            {extractedRequirements.map((req, i) => (
              <div
                key={i}
                className="flex gap-3 items-start p-2 hover:bg-muted/50 rounded group"
              >
                <input
                  type="checkbox"
                  aria-label={`Select requirement ${req.derivedCategory || "General"}`}
                  title={`Select requirement: ${req.originalText}`}
                  checked={selectedReqIds.has(req.id)}
                  onChange={() => toggleReq(req.id)}
                  className="mt-1"
                />
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-xs text-primary mb-0.5">
                    {req.derivedCategory || "General"}
                  </div>
                  <div
                    className="text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2"
                    title={req.originalText}
                  >
                    {req.originalText}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Parameters Selected: {selectedReqIds.size}</Label>
            <Button
              onClick={handleVerifyParams}
              className="w-full"
              disabled={selectedReqIds.size === 0 || loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {loading ? "Verifying..." : "Run Compliance Check"}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: VERIFYING */}
      {step === "verifying" && loading && (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-medium">Auditing Model...</h3>
            <p className="text-sm text-muted-foreground">
              Checking {selectedReqIds.size} requirements against the digital
              twin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
