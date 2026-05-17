"use client";

/**
 * ComplianceManager
 *
 * Single source of truth for the compliance runs UI.
 * Used by both the project detail tab (files supplied by parent) and the
 * standalone /dashboard/projects/[id]/compliance route (fetches its own
 * files when `initialFiles` is not provided).
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProjectConfigPanel,
  RunResultsPanel,
} from "@/components/compliance-v3";
import { useComplianceRuns } from "@/hooks/use-compliance-runs";
import { projectsService } from "@/lib/api/services";
import { DISCIPLINES } from "@/lib/api/compliance-v3.constants";
import type { ComplianceRun } from "@/lib/api/compliance-v3.types";
import type { EvaluateParams } from "@/lib/api/compliance-v3";
import type { ProjectFileDetail } from "@/lib/api/types";
import { showError } from "@/lib/error-handler";
import { useUser } from "@/context/UserContext";
import {
  ValidationUploader,
  type ValidationData,
} from "@/components/validation/validation-uploader";
import { ValidationViewer } from "@/components/validation/validation-viewer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_STATUS_VARIANT: Record<
  string,
  "default" | "outline" | "secondary" | "destructive"
> = {
  COMPLETED: "default",
  RUNNING: "secondary",
  PENDING: "outline",
  FAILED: "destructive",
  TIMEOUT: "destructive",
};

const TABS = ["Configuration", "Runs", "Results", "Spec Analysis"] as const;
type Tab = (typeof TABS)[number];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComplianceManagerProps {
  projectId: string;
  /**
   * Pre-loaded project files. Pass these when rendering inside the project
   * detail tab so the component doesn't need an extra fetch. When omitted
   * the component fetches its own files via `projectsService.get`.
   */
  initialFiles?: ProjectFileDetail[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComplianceManager({
  projectId,
  initialFiles,
}: ComplianceManagerProps) {
  const { user } = useUser();
  const { runs, loading, evaluate, deleteRun, fetchRuns } =
    useComplianceRuns(projectId);

  const [activeTab, setActiveTab] = useState<Tab>("Configuration");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Evaluation dialog state
  const [isEvalOpen, setIsEvalOpen] = useState(false);
  const [modelUrn, setModelUrn] = useState("");
  // "all" is a UI-only sentinel — mapped to `undefined` before the API call
  const [evalDiscipline, setEvalDiscipline] = useState<string>("all");
  const [evalLoading, setEvalLoading] = useState(false);

  // Delete confirmation dialog state
  const [runToDelete, setRunToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Spec Analysis (legacy validation uploader, now unified here)
  const [specValidationData, setSpecValidationData] =
    useState<ValidationData | null>(null);
  const [specPdfFiles, setSpecPdfFiles] = useState<{
    spec: File | null;
    norm: File | null;
    specUrl?: string | null;
  }>({ spec: null, norm: null });
  const [specSubTab, setSpecSubTab] = useState<"upload" | "viewer">("upload");

  // Files — provided by the parent or self-fetched
  const [files, setFiles] = useState<ProjectFileDetail[]>(initialFiles ?? []);
  const [filesLoading, setFilesLoading] = useState(initialFiles === undefined);

  useEffect(() => {
    // Sync when the parent updates its files array (e.g. after an upload)
    if (initialFiles !== undefined) {
      setFiles(initialFiles);
      return;
    }
    // Standalone mode: fetch the project and extract its file list
    let cancelled = false;
    const loadFiles = async () => {
      try {
        const project = await projectsService.get(projectId);
        if (!cancelled) setFiles(project.files ?? []);
      } catch (error) {
        if (!cancelled)
          showError(error, user?.role, "Failed to load project files");
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    };
    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [projectId, initialFiles, user?.role]);

  const readyFiles = files.filter((f) => f.apsUrn && f.status === "READY");
  const lastCompletedRun = runs.find(
    (r: ComplianceRun) => r.status === "COMPLETED",
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleEvaluate = async () => {
    setEvalLoading(true);
    try {
      const params: EvaluateParams = {
        modelUrn,
        // Map the "all" sentinel to undefined so the backend applies no filter
        discipline:
          evalDiscipline && evalDiscipline !== "all"
            ? evalDiscipline
            : undefined,
      };
      const run = await evaluate(params);
      setIsEvalOpen(false);
      setModelUrn("");
      setEvalDiscipline("all");
      setSelectedRunId(run.id);
      setActiveTab("Results");
      await fetchRuns();
    } catch (error) {
      showError(error, user?.role, "Failed to start compliance evaluation");
    } finally {
      setEvalLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!runToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteRun(runToDelete);
      if (selectedRunId === runToDelete) setSelectedRunId(null);
      toast.success("Evaluation deleted successfully");
    } catch (error) {
      showError(error, user?.role, "Failed to delete evaluation run");
    } finally {
      setDeleteLoading(false);
      setRunToDelete(null);
    }
  };

  const closeEvalDialog = (open: boolean) => {
    if (!open) {
      setIsEvalOpen(false);
      setModelUrn("");
      setEvalDiscipline("all");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Configuration */}
      {activeTab === "Configuration" && (
        <ProjectConfigPanel projectId={projectId} />
      )}

      {/* Runs */}
      {activeTab === "Runs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsEvalOpen(true)}>
              New Evaluation
            </Button>
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Started At</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Score</th>
                    <th className="text-left px-3 py-2">Elements</th>
                    <th className="text-left px-3 py-2">Issues</th>
                    <th className="text-left px-3 py-2">Dry Run</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run: ComplianceRun) => (
                    <tr
                      key={run.id}
                      className="border-t hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setSelectedRunId(run.id);
                        setActiveTab("Results");
                      }}
                    >
                      <td className="px-3 py-2 text-xs">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={RUN_STATUS_VARIANT[run.status] ?? "outline"}
                          className="text-xs"
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {run.complianceScore != null
                          ? `${Math.round(run.complianceScore)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{run.totalElements}</td>
                      <td className="px-3 py-2">{run.failedCount}</td>
                      <td className="px-3 py-2">
                        {run.dryRun && (
                          <Badge variant="outline" className="text-xs">
                            Dry
                          </Badge>
                        )}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={
                            run.status === "RUNNING" || run.status === "PENDING"
                          }
                          onClick={() => setRunToDelete(run.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No runs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {activeTab === "Results" &&
        (selectedRunId ? (
          <RunResultsPanel
            runId={selectedRunId}
            modelUrn={
              runs.find((r: ComplianceRun) => r.id === selectedRunId)?.modelUrn
            }
          />
        ) : lastCompletedRun ? (
          <RunResultsPanel
            runId={lastCompletedRun.id}
            modelUrn={lastCompletedRun.modelUrn}
          />
        ) : (
          <p className="text-muted-foreground">No completed runs available.</p>
        ))}

      {/* ── Spec Analysis (formerly standalone /validation route) ─────────── */}
      {activeTab === "Spec Analysis" && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b">
            {(["upload", "viewer"] as const).map((sub) => (
              <button
                key={sub}
                onClick={() => setSpecSubTab(sub)}
                disabled={sub === "viewer" && specValidationData === null}
                className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors disabled:opacity-40 ${
                  specSubTab === sub
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {sub === "upload" ? "New Audit" : "Compliance Report"}
              </button>
            ))}
          </div>

          {specSubTab === "upload" && (
            <ValidationUploader
              onUploadComplete={(data, files) => {
                setSpecValidationData(data);
                setSpecPdfFiles(files);
                setSpecSubTab("viewer");
              }}
            />
          )}

          {specSubTab === "viewer" && specValidationData && (
            <ValidationViewer data={specValidationData} files={specPdfFiles} />
          )}
        </div>
      )}

      {/* ── New Evaluation dialog ──────────────────────────────────────────── */}
      <Dialog open={isEvalOpen} onOpenChange={closeEvalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Compliance Evaluation</DialogTitle>
            <DialogDescription>
              Select a translated model file and an optional discipline filter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Model file */}
            <div className="space-y-1">
              <Label>Model file</Label>
              {filesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : readyFiles.length > 0 ? (
                <Select value={modelUrn} onValueChange={setModelUrn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a file to evaluate" />
                  </SelectTrigger>
                  <SelectContent>
                    {readyFiles.map((f) => (
                      <SelectItem key={f.id} value={f.apsUrn!}>
                        {f.originalName ?? f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No translated files available. Upload and translate a model
                  first.
                </p>
              )}
            </div>

            {/* Discipline */}
            <div className="space-y-1">
              <Label>Discipline (optional)</Label>
              <Select value={evalDiscipline} onValueChange={setEvalDiscipline}>
                <SelectTrigger>
                  <SelectValue placeholder="All disciplines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All disciplines</SelectItem>
                  {DISCIPLINES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => closeEvalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEvaluate}
              disabled={!modelUrn || evalLoading}
            >
              {evalLoading ? "Submitting..." : "Start Evaluation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ────────────────────────────────────── */}
      <Dialog
        open={runToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRunToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Evaluation</DialogTitle>
            <DialogDescription>
              This will permanently delete this run and all its issues. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRunToDelete(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
