"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  analyzeSuggestions,
  approveSuggestion,
  rejectSuggestion,
} from "@/lib/api/compliance-v3";
import type {
  StoredAnalysis,
  Requirement,
} from "@/lib/api/compliance-v3.types";
import type { ApiError } from "@/lib/api/types";

export interface UseSuggestionsReturn {
  analysis: StoredAnalysis | null;
  analyzing: boolean;
  error: ApiError | null;
  analyze: (text: string, discipline?: string) => Promise<void>;
  approve: (analysisId: string, index?: number) => Promise<Requirement>;
  reject: (analysisId: string) => Promise<void>;
}

export function useSuggestions(packId: string | null): UseSuggestionsReturn {
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const analyze = useCallback(
    async (text: string, discipline?: string): Promise<void> => {
      if (!packId) return;
      setAnalyzing(true);
      setError(null);
      try {
        const result = await analyzeSuggestions(packId, { text, discipline });
        setAnalysis(result);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setAnalyzing(false);
      }
    },
    [packId],
  );

  const approve = useCallback(
    async (analysisId: string, index?: number): Promise<Requirement> => {
      const result = await approveSuggestion(analysisId, { index });
      toast.success(`Requirement "${result.code}" created from suggestion`);
      return result;
    },
    [],
  );

  const reject = useCallback(async (analysisId: string): Promise<void> => {
    await rejectSuggestion(analysisId);
    setAnalysis(null);
  }, []);

  return { analysis, analyzing, error, analyze, approve, reject };
}
