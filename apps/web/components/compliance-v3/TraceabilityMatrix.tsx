"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ComplianceIssue } from "@/lib/api/compliance-v3.types";

interface TraceabilityMatrixProps {
  issues: ComplianceIssue[];
  onDisciplineFilter?: (discipline: string | null) => void;
}

interface RuleGroup {
  ruleName: string;
  ruleId: string;
  discipline: string;
  severity: string;
  legalReference: string | null | undefined;
  elements: ComplianceIssue[];
}

const PAGE_SIZE = 10;

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  WARNING: "bg-yellow-100 text-yellow-800",
  INFO: "bg-blue-100 text-blue-800",
};

export function TraceabilityMatrix({
  issues,
  onDisciplineFilter,
}: TraceabilityMatrixProps) {
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("ALL");
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const disciplines = useMemo(() => {
    const set = new Set(issues.map((i) => i.elementCategory ?? "Unknown"));
    return ["ALL", ...Array.from(set).sort()];
  }, [issues]);

  const ruleGroups = useMemo(() => {
    const map = new Map<string, RuleGroup>();
    for (const issue of issues) {
      const existing = map.get(issue.ruleName);
      if (existing) {
        existing.elements.push(issue);
      } else {
        map.set(issue.ruleName, {
          ruleName: issue.ruleName,
          ruleId: issue.ruleId,
          discipline: issue.elementCategory ?? "Unknown",
          severity: issue.severity,
          legalReference: issue.legalReference,
          elements: [issue],
        });
      }
    }
    return Array.from(map.values());
  }, [issues]);

  const filtered = useMemo(() => {
    return ruleGroups.filter((g) => {
      const matchesDiscipline =
        disciplineFilter === "ALL" || g.discipline === disciplineFilter;
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        g.ruleName.toLowerCase().includes(term) ||
        (g.legalReference ?? "").toLowerCase().includes(term);
      return matchesDiscipline && matchesSearch;
    });
  }, [ruleGroups, disciplineFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleDisciplineChange(value: string) {
    setDisciplineFilter(value);
    setPage(1);
    onDisciplineFilter?.(value === "ALL" ? null : value);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleRule(ruleName: string) {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleName)) {
        next.delete(ruleName);
      } else {
        next.add(ruleName);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search by code or reference..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />
        <Select value={disciplineFilter} onValueChange={handleDisciplineChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All disciplines" />
          </SelectTrigger>
          <SelectContent>
            {disciplines.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Code</TableHead>
              <TableHead>Legal Ref</TableHead>
              <TableHead>Discipline</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Severity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-6"
                >
                  No rules match the current filters.
                </TableCell>
              </TableRow>
            )}
            {paginated.map((group) => {
              const isExpanded = expandedRules.has(group.ruleName);
              const severityStyle =
                SEVERITY_STYLES[group.severity] ?? "bg-gray-100 text-gray-800";

              return [
                <TableRow
                  key={group.ruleName}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleRule(group.ruleName)}
                >
                  <TableCell className="py-2">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs py-2">
                    {group.ruleName}
                  </TableCell>
                  <TableCell className="text-xs py-2 max-w-[180px] truncate">
                    {group.legalReference ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    {group.discipline}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {group.elements.length}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-xs ${severityStyle}`}>
                      {group.severity}
                    </Badge>
                  </TableCell>
                </TableRow>,
                isExpanded && (
                  <TableRow key={`${group.ruleName}-elements`}>
                    <TableCell colSpan={6} className="p-0">
                      <div className="bg-muted/50 px-4 py-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">
                                Element ID
                              </TableHead>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">
                                Category
                              </TableHead>
                              <TableHead className="text-xs">
                                Expected
                              </TableHead>
                              <TableHead className="text-xs">Actual</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.elements.map((el) => (
                              <TableRow key={el.id}>
                                <TableCell className="font-mono text-xs py-1">
                                  {el.elementId}
                                </TableCell>
                                <TableCell className="text-xs py-1">
                                  {el.elementName ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs py-1">
                                  {el.elementCategory ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs py-1">
                                  {el.expectedValue ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs py-1 text-red-700">
                                  {el.actualValue ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              ];
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtered.length} rule{filtered.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
