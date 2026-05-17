"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  Layers,
  ClipboardList,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { useRunDetail } from "@/hooks/use-compliance-runs";
import type {
  ComplianceIssue,
  ComplianceRun,
} from "@/lib/api/compliance-v3.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type SeverityFilter = "ALL" | "CRITICAL" | "WARNING" | "INFO";

interface RequirementBreakdownEntry {
  id: string;
  code: string;
  description: string;
  discipline: string;
  severity: string;
  legalReference: string;
  matchedElements: number;
  passed: number;
  failed: number;
}

interface RunMeta {
  elementsByCategory?: Record<string, number>;
  requirementBreakdown?: RequirementBreakdownEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  WARNING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  INFO: "bg-blue-100 text-blue-800 border-blue-200",
};

function scoreRingColor(score: number): string {
  if (score >= 80) return "border-green-500";
  if (score >= 60) return "border-yellow-500";
  return "border-red-500";
}

function scoreLabelColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function complianceLabel(score: number): { text: string; className: string } {
  if (score >= 80)
    return {
      text: "Compliant",
      className: "text-green-700 bg-green-50 border-green-200",
    };
  if (score >= 60)
    return {
      text: "Needs Attention",
      className: "text-yellow-700 bg-yellow-50 border-yellow-200",
    };
  return {
    text: "Non-Compliant",
    className: "text-red-700 bg-red-50 border-red-200",
  };
}

// ─── FailedRunDetail ──────────────────────────────────────────────────────────

function FailedRunDetail({ run }: { run: ComplianceRun }) {
  const meta = run.metadata as Record<string, unknown> | undefined;
  const errorMsg =
    (meta?.error as string | undefined) ??
    (meta?.errorMessage as string | undefined) ??
    (meta?.message as string | undefined) ??
    "No error details available.";
  const errorStack = meta?.stack as string | undefined;

  return (
    <Alert variant="destructive" className="space-y-2">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-semibold mb-1">Evaluation failed</p>
        <p className="text-sm font-mono whitespace-pre-wrap break-all">
          {errorMsg}
        </p>
        {errorStack && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs underline">
              Stack trace
            </summary>
            <pre className="mt-1 text-xs whitespace-pre-wrap break-all bg-destructive/10 p-2 rounded">
              {errorStack}
            </pre>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ─── ExpandedIssueDetail ──────────────────────────────────────────────────────

function ExpandedIssueDetail({
  issue,
  modelUrn,
}: {
  issue: ComplianceIssue;
  modelUrn?: string;
}) {
  return (
    <div className="px-4 py-3 border-t bg-muted/30 space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <span className="text-muted-foreground">Element ID</span>
        <span className="font-mono break-all">{issue.elementId}</span>

        {issue.elementName && (
          <>
            <span className="text-muted-foreground">Name</span>
            <span>{issue.elementName}</span>
          </>
        )}
        {issue.elementCategory && (
          <>
            <span className="text-muted-foreground">Category</span>
            <span>{issue.elementCategory}</span>
          </>
        )}

        <span className="text-muted-foreground">Rule</span>
        <span className="font-medium">{issue.ruleName}</span>

        <span className="text-muted-foreground">Expected</span>
        <span>{issue.expectedValue ?? "—"}</span>

        <span className="text-muted-foreground">Actual</span>
        <span className={issue.actualValue ? "text-red-700 font-medium" : ""}>
          {issue.actualValue ?? "—"}
        </span>

        {issue.deviation != null && (
          <>
            <span className="text-muted-foreground">Deviation</span>
            <span>{issue.deviation}</span>
          </>
        )}
        {issue.legalReference && (
          <>
            <span className="text-muted-foreground">Legal Reference</span>
            <Badge variant="outline" className="text-xs font-normal w-fit">
              {issue.legalReference}
            </Badge>
          </>
        )}
      </div>

      {modelUrn && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          asChild
        >
          <a
            href={`/dashboard/viewer?urn=${encodeURIComponent(modelUrn)}&select=${encodeURIComponent(issue.elementId)}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-3 w-3" />
            View in 3D Viewer
          </a>
        </Button>
      )}
    </div>
  );
}

// ─── RequirementRow ───────────────────────────────────────────────────────────

function RequirementRow({ req }: { req: RequirementBreakdownEntry }) {
  const isNotApplicable = req.matchedElements === 0;
  const hasFailed = req.failed > 0;

  return (
    <div
      className={`flex items-start gap-3 py-2.5 px-3 ${isNotApplicable ? "opacity-50" : ""}`}
    >
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {isNotApplicable ? (
          <MinusCircle className="h-4 w-4 text-muted-foreground" />
        ) : hasFailed ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
      </div>

      {/* Requirement info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold shrink-0">
            {req.code}
          </span>
          <span className="text-xs truncate" title={req.description}>
            {req.description}
          </span>
          {req.severity && (
            <Badge
              className={`text-[10px] shrink-0 border ${
                SEVERITY_STYLES[req.severity.toUpperCase()] ?? ""
              }`}
            >
              {req.severity}
            </Badge>
          )}
        </div>
        {req.legalReference && (
          <p className="text-[10px] text-muted-foreground">
            {req.legalReference}
          </p>
        )}
      </div>

      {/* Result summary */}
      <div className="shrink-0 text-right min-w-[90px]">
        {isNotApplicable ? (
          <span className="text-[11px] text-muted-foreground italic">
            Not applicable
          </span>
        ) : hasFailed ? (
          <span className="text-[11px] font-semibold text-red-600">
            {req.failed} failed
          </span>
        ) : (
          <span className="text-[11px] text-green-600">
            {req.matchedElements} passed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── DisciplineSection ────────────────────────────────────────────────────────

function DisciplineSection({
  discipline,
  reqs,
}: {
  discipline: string;
  reqs: RequirementBreakdownEntry[];
}) {
  const hasFailures = reqs.some((r) => r.failed > 0);
  const [open, setOpen] = useState(hasFailures);

  const applicable = reqs.filter((r) => r.matchedElements > 0);
  const failed = reqs.filter((r) => r.failed > 0);

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors bg-muted/20"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold uppercase tracking-wide">
          {discipline}
        </span>
        <span className="text-xs text-muted-foreground">
          {reqs.length} requirement{reqs.length !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto">
          {failed.length > 0 ? (
            <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
              {failed.length} with issues
            </span>
          ) : applicable.length > 0 ? (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">
              All passing
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              No matches
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {reqs.map((req) => (
            <RequirementRow key={req.id} req={req} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ModelComposition ─────────────────────────────────────────────────────────

const CATEGORY_LIMIT = 8;

function ModelComposition({ meta }: { meta: RunMeta }) {
  const [showAll, setShowAll] = useState(false);
  const cats = meta.elementsByCategory;
  if (!cats || Object.keys(cats).length === 0) return null;

  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  const visible = showAll ? sorted : sorted.slice(0, CATEGORY_LIMIT);
  const remaining = sorted.length - CATEGORY_LIMIT;

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/20 flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Model Composition</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} categories · {total.toLocaleString()} elements
        </span>
      </div>

      <div className="border-t grid grid-cols-2 gap-x-6 gap-y-0 p-3">
        {visible.map(([cat, count]) => {
          const pct = ((count / total) * 100).toFixed(1);
          return (
            <div key={cat} className="flex items-center gap-2 py-1">
              <span
                className="text-xs text-muted-foreground flex-1 truncate"
                title={cat}
              >
                {cat}
              </span>
              <span className="text-xs font-mono font-medium tabular-nums shrink-0">
                {count.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-10 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {sorted.length > CATEGORY_LIMIT && (
        <div className="border-t px-4 py-2">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {showAll
              ? "Show less"
              : `Show ${remaining} more categor${remaining === 1 ? "y" : "ies"}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── IssuesByRule ─────────────────────────────────────────────────────────────

function IssuesByRule({
  issues,
  modelUrn,
  severityFilter,
  onFilterChange,
  severityCounts,
  pagination,
  onPageChange,
}: {
  issues: ComplianceIssue[];
  modelUrn?: string;
  severityFilter: SeverityFilter;
  onFilterChange: (s: SeverityFilter) => void;
  severityCounts: Record<string, number>;
  pagination?: { page: number; totalPages: number } | null;
  onPageChange: (page: number) => void;
}) {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const filteredIssues = useMemo(() => {
    if (severityFilter === "ALL") return issues;
    return issues.filter((i) => i.severity === severityFilter);
  }, [issues, severityFilter]);

  // Group the current page of issues by rule name
  const grouped = useMemo(() => {
    const map = new Map<string, ComplianceIssue[]>();
    for (const issue of filteredIssues) {
      const key = issue.ruleName ?? "Unknown rule";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filteredIssues]);

  function toggleRule(key: string) {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleIssue(id: string) {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const totalCount = issues.length;

  return (
    <div className="space-y-3">
      {/* Header + severity filter chips */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-medium">
          Issues
          {totalCount > 0 && (
            <span className="ml-1 text-muted-foreground font-normal text-sm">
              ({totalCount} · {grouped.length} rule
              {grouped.length !== 1 ? "s" : ""} affected)
            </span>
          )}
        </h3>
        <div className="flex gap-1.5 flex-wrap">
          {(["ALL", "CRITICAL", "WARNING", "INFO"] as SeverityFilter[]).map(
            (s) => {
              const count = s === "ALL" ? totalCount : (severityCounts[s] ?? 0);
              return (
                <button
                  key={s}
                  onClick={() => onFilterChange(s)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    severityFilter === s
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:border-foreground"
                  }`}
                >
                  {s}
                  {count > 0 && (
                    <span className="ml-1 opacity-75">({count})</span>
                  )}
                </button>
              );
            },
          )}
        </div>
      </div>

      {filteredIssues.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
          {severityFilter === "ALL"
            ? "No issues found."
            : `No ${severityFilter} issues.`}
        </p>
      ) : (
        <>
          <ScrollArea className="max-h-[520px]">
            <div className="space-y-1 pr-1">
              {grouped.map(([ruleName, ruleIssues]) => {
                const isRuleOpen = expandedRules.has(ruleName);
                const maxSeverity = ruleIssues.some(
                  (i) => i.severity === "CRITICAL",
                )
                  ? "CRITICAL"
                  : ruleIssues.some((i) => i.severity === "WARNING")
                    ? "WARNING"
                    : "INFO";

                return (
                  <div
                    key={ruleName}
                    className="border rounded-md overflow-hidden"
                  >
                    {/* Rule header — shows how many elements failed this rule */}
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => toggleRule(ruleName)}
                    >
                      {isRuleOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <Badge
                        className={`text-xs shrink-0 border ${
                          SEVERITY_STYLES[maxSeverity] ?? ""
                        }`}
                      >
                        {maxSeverity}
                      </Badge>
                      <span className="text-sm font-medium truncate flex-1">
                        {ruleName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {ruleIssues.length} element
                        {ruleIssues.length !== 1 ? "s" : ""}
                      </span>
                    </button>

                    {/* Expandable list of individual elements */}
                    {isRuleOpen && (
                      <div className="border-t divide-y">
                        {ruleIssues.map((issue) => {
                          const isIssueOpen = expandedIssues.has(issue.id);
                          return (
                            <div key={issue.id}>
                              <button
                                className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-muted/30 transition-colors"
                                onClick={() => toggleIssue(issue.id)}
                              >
                                {isIssueOpen ? (
                                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                )}
                                <span className="text-xs truncate flex-1">
                                  {issue.elementName ?? issue.elementId}
                                  {issue.elementCategory && (
                                    <span className="ml-1 text-muted-foreground">
                                      · {issue.elementCategory}
                                    </span>
                                  )}
                                </span>
                              </button>
                              {isIssueOpen && (
                                <ExpandedIssueDetail
                                  issue={issue}
                                  modelUrn={modelUrn}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => onPageChange(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm self-center">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export interface RunResultsPanelProps {
  runId: string;
  /** Optional: overrides run.modelUrn for "View in Viewer" links */
  modelUrn?: string;
}

export function RunResultsPanel({ runId, modelUrn }: RunResultsPanelProps) {
  const {
    run,
    issues,
    issuesPagination,
    loading,
    issuesLoading,
    setIssuePage,
  } = useRunDetail(runId);

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");

  const severityCounts = useMemo(
    () => ({
      CRITICAL: issues.filter((i) => i.severity === "CRITICAL").length,
      WARNING: issues.filter((i) => i.severity === "WARNING").length,
      INFO: issues.filter((i) => i.severity === "INFO").length,
    }),
    [issues],
  );

  // Must be before early returns to avoid hook order violations
  const allReqs = useMemo(
    () => ((run?.metadata ?? {}) as RunMeta).requirementBreakdown ?? [],
    [run],
  );

  const reqsByDiscipline = useMemo(() => {
    const map = new Map<string, RequirementBreakdownEntry[]>();
    for (const req of allReqs) {
      const key = req.discipline || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(req);
    }
    return [...map.entries()].sort((a, b) => {
      const aF = a[1].some((r) => r.failed > 0) ? 1 : 0;
      const bF = b[1].some((r) => r.failed > 0) ? 1 : 0;
      return bF - aF;
    });
  }, [allReqs]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!run)
    return <p className="text-muted-foreground">No run data available.</p>;
  if (run.status === "FAILED") return <FailedRunDetail run={run} />;

  const score = Math.round(run.complianceScore ?? 0);
  const effectiveUrn = modelUrn ?? run.modelUrn;
  const meta = (run.metadata ?? {}) as RunMeta;
  const label = complianceLabel(score);

  const totalReqs = allReqs.length;
  const applicableReqs = allReqs.filter((r) => r.matchedElements > 0).length;
  const failedReqs = allReqs.filter((r) => r.failed > 0).length;

  // Detect legacy runs (completed before breakdown data was added)
  const isLegacyRun =
    run.status === "COMPLETED" &&
    !Object.prototype.hasOwnProperty.call(
      run.metadata ?? {},
      "requirementBreakdown",
    );

  return (
    <div className="space-y-5">
      {/* ── Score + status header ── */}
      <div className="flex items-center gap-5">
        <div
          className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 shrink-0 ${scoreRingColor(score)}`}
        >
          <span className={`text-2xl font-bold ${scoreLabelColor(score)}`}>
            {score}%
          </span>
          <span className="text-[10px] text-muted-foreground">Score</span>
        </div>

        <div className="space-y-2">
          <span
            className={`inline-flex items-center px-3 py-0.5 rounded border text-sm font-semibold ${label.className}`}
          >
            {label.text}
          </span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
            <span className="text-muted-foreground">Elements analyzed</span>
            <span className="font-semibold tabular-nums">
              {(run.totalElements ?? 0).toLocaleString()}
            </span>
            {!isLegacyRun && (
              <>
                <span className="text-muted-foreground">Requirements</span>
                <span className="font-semibold tabular-nums">
                  {applicableReqs} of {totalReqs} applicable
                </span>
                <span className="text-muted-foreground">Rules with issues</span>
                <span
                  className={`font-semibold tabular-nums ${
                    failedReqs > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {failedReqs}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Legacy run notice ── */}
      {isLegacyRun && (
        <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <p className="font-medium text-sm">
              Detailed breakdown not available for this run
            </p>
            <p className="text-xs mt-0.5">
              This evaluation was completed before requirement tracking was
              introduced. Run a new evaluation to see Requirements by Discipline
              and Model Composition.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Requirements by Discipline ── */}
      {reqsByDiscipline.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Requirements by Discipline
          </h3>
          <div className="space-y-1.5">
            {reqsByDiscipline.map(([discipline, reqs]) => (
              <DisciplineSection
                key={discipline}
                discipline={discipline}
                reqs={reqs}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Model Composition ── */}
      <ModelComposition meta={meta} />

      {/* ── Issues grouped by rule ── */}
      {issuesLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <IssuesByRule
          issues={issues}
          modelUrn={effectiveUrn}
          severityFilter={severityFilter}
          onFilterChange={setSeverityFilter}
          severityCounts={severityCounts}
          pagination={issuesPagination}
          onPageChange={setIssuePage}
        />
      )}
    </div>
  );
}
