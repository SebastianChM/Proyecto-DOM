"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import type { ComplianceIssue } from "@/lib/api/compliance-v3.types";

interface IssueDetailPanelProps {
  issues: ComplianceIssue[];
  discipline?: string;
}

type SeverityFilter = "ALL" | "CRITICAL" | "WARNING" | "INFO";

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  WARNING: "bg-yellow-100 text-yellow-800",
  INFO: "bg-blue-100 text-blue-800",
};

export function IssueDetailPanel({
  issues,
  discipline,
}: IssueDetailPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (severityFilter === "ALL") return issues;
    return issues.filter((i) => i.severity === severityFilter);
  }, [issues, severityFilter]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {discipline && <h3 className="text-sm font-semibold">{discipline}</h3>}

      <div className="flex gap-2 flex-wrap">
        {(["ALL", "CRITICAL", "WARNING", "INFO"] as SeverityFilter[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                severityFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              {s}
            </button>
          ),
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No issues match the current filter.
        </p>
      )}

      <ScrollArea className="h-96">
        <div className="space-y-1 pr-3">
          {filtered.map((issue) => {
            const isExpanded = expandedIds.has(issue.id);
            const severityStyle =
              SEVERITY_STYLES[issue.severity] ?? "bg-gray-100 text-gray-800";

            return (
              <div key={issue.id} className="border rounded-md overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpanded(issue.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <Badge className={`text-xs shrink-0 ${severityStyle}`}>
                    {issue.severity}
                  </Badge>
                  <span className="text-xs truncate flex-1">
                    {issue.elementName ?? issue.elementId}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {issue.ruleName}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 py-3 border-t bg-muted/30 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-muted-foreground">Element ID</span>
                      <span className="font-mono">{issue.elementId}</span>
                      {issue.elementName && (
                        <>
                          <span className="text-muted-foreground">
                            Element name
                          </span>
                          <span>{issue.elementName}</span>
                        </>
                      )}
                      <span className="text-muted-foreground">Property</span>
                      <span className="font-medium">{issue.ruleName}</span>
                      <span className="text-muted-foreground">Expected</span>
                      <span>{issue.expectedValue ?? "—"}</span>
                      <span className="text-muted-foreground">Actual</span>
                      <span
                        className={
                          issue.actualValue ? "text-red-700 font-medium" : ""
                        }
                      >
                        {issue.actualValue ?? "—"}
                      </span>
                      {issue.deviation !== undefined &&
                        issue.deviation !== null && (
                          <>
                            <span className="text-muted-foreground">
                              Deviation
                            </span>
                            <span>{issue.deviation}</span>
                          </>
                        )}
                    </div>

                    {issue.legalReference && (
                      <div className="flex items-center gap-2 pt-1">
                        <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {issue.legalReference}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
