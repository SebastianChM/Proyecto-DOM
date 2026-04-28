"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  evaluateCompliance,
  getRunById,
  getRunsByProject,
  getRunIssues,
} from "@/lib/api/compliance-v3";
import { usePollingWithBackoff } from "@/hooks/usePollingWithBackoff";
import type {
  ComplianceRun,
  ComplianceIssue,
  V3PaginatedResponse,
} from "@/lib/api/compliance-v3.types";
import type { ApiError } from "@/lib/api/types";
import type { EvaluateParams } from "@/lib/api/compliance-v3";

const TERMINAL_STATUSES = new Set<ComplianceRun["status"]>([
  "COMPLETED",
  "FAILED",
  "TIMEOUT",
]);

export interface UseComplianceRunsReturn {
  runs: ComplianceRun[];
  pagination: V3PaginatedResponse<ComplianceRun>["pagination"] | null;
  loading: boolean;
  error: ApiError | null;
  fetchRuns: () => Promise<void>;
  evaluate: (params: EvaluateParams) => Promise<ComplianceRun>;
  pollRun: (runId: string, onComplete: (run: ComplianceRun) => void) => void;
}

export interface UseRunDetailReturn {
  run: ComplianceRun | null;
  issues: ComplianceIssue[];
  issuesPagination: V3PaginatedResponse<ComplianceIssue>["pagination"] | null;
  loading: boolean;
  issuesLoading: boolean;
  error: ApiError | null;
  fetchRun: () => Promise<void>;
  fetchIssues: (params?: {
    page?: number;
    limit?: number;
    severity?: string;
  }) => Promise<void>;
  setIssuePage: (page: number) => void;
}

export function useComplianceRuns(
  projectId: string | null,
): UseComplianceRunsReturn {
  const [runs, setRuns] = useState<ComplianceRun[]>([]);
  const [pagination, setPagination] = useState<
    V3PaginatedResponse<ComplianceRun>["pagination"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const [pollingRunId, setPollingRunId] = useState<string | null>(null);
  const pollingCallbackRef = useRef<((run: ComplianceRun) => void) | null>(
    null,
  );

  usePollingWithBackoff<ComplianceRun>({
    fn: async () => {
      if (!pollingRunId) throw new Error("no run");
      return getRunById(pollingRunId);
    },
    enabled: pollingRunId !== null,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    maxRetries: 30,
    jitter: 0.1,
    onSuccess: (run) => {
      if (TERMINAL_STATUSES.has(run.status)) {
        pollingCallbackRef.current?.(run);
        setPollingRunId(null);
        return true;
      }
    },
    onTimeout: () => {
      setPollingRunId(null);
    },
  });

  const fetchRuns = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRunsByProject(projectId);
      setRuns(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const evaluate = useCallback(
    async (params: EvaluateParams): Promise<ComplianceRun> => {
      if (!projectId)
        throw new Error("projectId is required to evaluate compliance");
      const run = await evaluateCompliance(projectId, params);
      setRuns((prev) => [run, ...prev]);
      return run;
    },
    [projectId],
  );

  const pollRun = useCallback(
    (runId: string, onComplete: (run: ComplianceRun) => void) => {
      pollingCallbackRef.current = onComplete;
      setPollingRunId(runId);
    },
    [],
  );

  return { runs, pagination, loading, error, fetchRuns, evaluate, pollRun };
}

export function useRunDetail(runId: string | null): UseRunDetailReturn {
  const [run, setRun] = useState<ComplianceRun | null>(null);
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [issuesPagination, setIssuesPagination] = useState<
    V3PaginatedResponse<ComplianceIssue>["pagination"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [issueParams, setIssueParams] = useState<{
    page?: number;
    limit?: number;
    severity?: string;
  }>({});

  const fetchRun = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRunById(runId);
      setRun(result);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  const fetchIssues = useCallback(
    async (params?: { page?: number; limit?: number; severity?: string }) => {
      if (!runId) return;
      setIssuesLoading(true);
      try {
        const resolved = params ?? issueParams;
        const result = await getRunIssues(runId, resolved);
        setIssues(result.data);
        setIssuesPagination(result.pagination);
        if (params) setIssueParams(params);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setIssuesLoading(false);
      }
    },
    [runId, issueParams],
  );

  useEffect(() => {
    fetchRun();
    fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const setIssuePage = useCallback(
    (page: number) => {
      fetchIssues({ ...issueParams, page });
    },
    [fetchIssues, issueParams],
  );

  return {
    run,
    issues,
    issuesPagination,
    loading,
    issuesLoading,
    error,
    fetchRun,
    fetchIssues,
    setIssuePage,
  };
}
