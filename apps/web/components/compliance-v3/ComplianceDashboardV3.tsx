"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useComplianceRuns } from "@/hooks/use-compliance-runs";
import { useComplianceRunIssues } from "@/hooks/use-compliance-run-issues";
import { DisciplineScoreCard } from "./DisciplineScoreCard";
import { ComplianceExport } from "./ComplianceExport";
import type { ComplianceRun } from "@/lib/api/compliance-v3.types";

interface ComplianceDashboardV3Props {
  projectId: string;
}

function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-gray-100 text-gray-600";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function formatRunLabel(run: ComplianceRun): string {
  const date = new Date(run.startedAt).toLocaleDateString();
  const score =
    run.metadata &&
    typeof run.metadata === "object" &&
    "complianceScore" in run.metadata &&
    run.metadata.complianceScore !== null
      ? ` — ${run.metadata.complianceScore}%`
      : "";
  return `${date}${score} (${run.status})`;
}

export function ComplianceDashboardV3({
  projectId,
}: ComplianceDashboardV3Props) {
  const {
    runs,
    loading: runsLoading,
    error: runsError,
    fetchRuns,
  } = useComplianceRuns(projectId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = useMemo(
    () =>
      selectedRunId
        ? (runs.find((r) => r.id === selectedRunId) ?? null)
        : (runs[0] ?? null),
    [runs, selectedRunId],
  );

  const effectiveRunId = selectedRun?.id ?? null;
  const {
    issues,
    loading: issuesLoading,
    error: issuesError,
  } = useComplianceRunIssues(effectiveRunId);

  const disciplineGroups = useMemo(() => {
    const groups: Record<
      string,
      { total: number; mandatory: number; recommended: number }
    > = {};
    for (const issue of issues) {
      const key = issue.elementCategory ?? "Unknown";
      if (!groups[key]) {
        groups[key] = { total: 0, mandatory: 0, recommended: 0 };
      }
      groups[key].total += 1;
      if (issue.severity === "CRITICAL") {
        groups[key].mandatory += 1;
      } else if (issue.severity === "WARNING") {
        groups[key].recommended += 1;
      }
    }
    return groups;
  }, [issues]);

  const metadata = selectedRun?.metadata as
    | {
        processedElements?: number;
        totalElements?: number;
        complianceScore?: number | null;
      }
    | undefined;

  const progressPercent =
    metadata?.totalElements && metadata.totalElements > 0
      ? Math.round(
          ((metadata.processedElements ?? 0) / metadata.totalElements) * 100,
        )
      : 0;

  const score =
    metadata?.complianceScore ?? selectedRun?.complianceScore ?? null;

  if (runsLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Loading runs...</span>
      </div>
    );
  }

  if (runsError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load compliance runs: {runsError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Select
            value={effectiveRunId ?? ""}
            onValueChange={(val) => setSelectedRunId(val)}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a run..." />
            </SelectTrigger>
            <SelectContent>
              {runs.map((run) => (
                <SelectItem key={run.id} value={run.id}>
                  {formatRunLabel(run)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={fetchRuns}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {effectiveRunId && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Compliance Report</DialogTitle>
              </DialogHeader>
              <ComplianceExport
                runId={effectiveRunId}
                projectName={projectId}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {selectedRun?.status === "RUNNING" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Evaluation in progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {metadata?.processedElements ?? 0} /{" "}
              {metadata?.totalElements ?? "—"} elements processed
            </p>
          </CardContent>
        </Card>
      )}

      {selectedRun?.status === "COMPLETED" && (
        <Card>
          <CardContent className="flex items-center gap-6 pt-6">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold ${scoreColor(score)}`}
            >
              {score !== null && score !== undefined ? `${score}%` : "—"}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {(score ?? 0) >= 80 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (score ?? 0) >= 60 ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-semibold">
                  {(score ?? 0) >= 80
                    ? "Compliant"
                    : (score ?? 0) >= 60
                      ? "Partially compliant"
                      : "Non-compliant"}
                </span>
              </div>
              <Badge variant="secondary">{issues.length} issues found</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedRun &&
        ["ERROR", "FAILED", "TIMEOUT"].includes(selectedRun.status) && (
          <Alert variant="destructive">
            <AlertDescription>
              Evaluation ended with status:{" "}
              <strong>{selectedRun.status}</strong>
            </AlertDescription>
          </Alert>
        )}

      {issuesError && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load issues: {issuesError.message}
          </AlertDescription>
        </Alert>
      )}

      {!issuesLoading && Object.keys(disciplineGroups).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(disciplineGroups).map(([discipline, counts]) => (
            <DisciplineScoreCard
              key={discipline}
              discipline={discipline}
              totalIssues={counts.total}
              mandatoryIssues={counts.mandatory}
              recommendedIssues={counts.recommended}
            />
          ))}
        </div>
      )}
    </div>
  );
}
