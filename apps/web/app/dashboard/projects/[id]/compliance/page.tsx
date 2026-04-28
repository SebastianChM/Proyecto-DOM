"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectConfigPanel } from "@/components/compliance-v3";
import { useComplianceRuns, useRunDetail } from "@/hooks/use-compliance-runs";
import { DISCIPLINES } from "@/lib/api/compliance-v3.constants";
import type {
  ComplianceRun,
  ComplianceIssue,
} from "@/lib/api/compliance-v3.types";
import type { EvaluateParams } from "@/lib/api/compliance-v3";

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

const TABS = ["Configuration", "Runs", "Results"] as const;
type Tab = (typeof TABS)[number];

function RunResultsPanel({ runId }: { runId: string }) {
  const {
    run,
    issues,
    issuesPagination,
    loading,
    issuesLoading,
    setIssuePage,
  } = useRunDetail(runId);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!run) {
    return <p className="text-muted-foreground">No run data available.</p>;
  }

  const score = Math.round((run.complianceScore ?? 0) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-primary">
          <span className="text-2xl font-bold">{score}%</span>
          <span className="text-xs text-muted-foreground">Score</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Elements</p>
            <p className="font-semibold text-lg">{run.totalElements}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Passed</p>
            <p className="font-semibold text-lg text-green-600">
              {run.passedCount}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Failed</p>
            <p className="font-semibold text-lg text-destructive">
              {run.failedCount}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">Issues</h3>
        {issuesLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Element</th>
                    <th className="text-left px-3 py-2">Rule</th>
                    <th className="text-left px-3 py-2">Severity</th>
                    <th className="text-left px-3 py-2">Actual</th>
                    <th className="text-left px-3 py-2">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue: ComplianceIssue) => (
                    <tr key={issue.id} className="border-t">
                      <td className="px-3 py-2 text-xs font-mono">
                        {issue.elementName ?? issue.elementId}
                      </td>
                      <td className="px-3 py-2 text-xs">{issue.ruleName}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            issue.severity === "CRITICAL"
                              ? "destructive"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {issue.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {issue.actualValue ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {issue.expectedValue ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {issues.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-muted-foreground"
                      >
                        No issues found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {issuesPagination && issuesPagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={issuesPagination.page <= 1}
                  onClick={() => setIssuePage(issuesPagination.page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm self-center">
                  Page {issuesPagination.page} of {issuesPagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    issuesPagination.page >= issuesPagination.totalPages
                  }
                  onClick={() => setIssuePage(issuesPagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ProjectCompliancePageProps {
  params: Promise<{ id: string }>;
}

function CompliancePage({ projectId }: { projectId: string }) {
  const { runs, loading, evaluate, fetchRuns } = useComplianceRuns(projectId);
  const [activeTab, setActiveTab] = useState<Tab>("Configuration");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isEvalOpen, setIsEvalOpen] = useState(false);
  const [modelUrn, setModelUrn] = useState("");
  const [evalDiscipline, setEvalDiscipline] = useState("");
  const [evalLoading, setEvalLoading] = useState(false);

  const lastCompletedRun = runs.find(
    (r: ComplianceRun) => r.status === "COMPLETED",
  );

  const handleEvaluate = async () => {
    setEvalLoading(true);
    try {
      const params: EvaluateParams = {
        modelUrn,
        discipline: evalDiscipline || undefined,
      };
      const run = await evaluate(params);
      setIsEvalOpen(false);
      setModelUrn("");
      setEvalDiscipline("");
      setSelectedRunId(run.id);
      setActiveTab("Runs");
      await fetchRuns();
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">Compliance</h1>

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

      {activeTab === "Configuration" && (
        <ProjectConfigPanel projectId={projectId} />
      )}

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
                          ? `${Math.round(run.complianceScore * 100)}%`
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
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
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

      {activeTab === "Results" &&
        (selectedRunId ? (
          <RunResultsPanel runId={selectedRunId} />
        ) : lastCompletedRun ? (
          <RunResultsPanel runId={lastCompletedRun.id} />
        ) : (
          <p className="text-muted-foreground">No completed runs available.</p>
        ))}

      <Dialog open={isEvalOpen} onOpenChange={setIsEvalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Compliance Evaluation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="modelUrn">Model URN</Label>
              <Input
                id="modelUrn"
                placeholder="urn:adsk.objects:..."
                value={modelUrn}
                onChange={(e) => setModelUrn(e.target.value)}
              />
            </div>
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
            <Button variant="outline" onClick={() => setIsEvalOpen(false)}>
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
    </div>
  );
}

export default function ProjectCompliancePage({
  params,
}: ProjectCompliancePageProps) {
  const { id } = use(params);
  return <CompliancePage projectId={id} />;
}
