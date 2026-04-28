"use client";

import { useState, useEffect, useCallback } from "react";
import { getRunIssues } from "@/lib/api/compliance-v3";
import type { ComplianceIssue } from "@/lib/api/compliance-v3.types";
import type { ApiError } from "@/lib/api/types";

export interface UseComplianceRunIssuesReturn {
  issues: ComplianceIssue[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useComplianceRunIssues(
  runId: string | null,
): UseComplianceRunIssuesReturn {
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRunIssues(runId, { limit: 100 });
      setIssues(result.data);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    setIssues([]);
    refetch();
  }, [refetch]);

  return { issues, loading, error, refetch };
}
