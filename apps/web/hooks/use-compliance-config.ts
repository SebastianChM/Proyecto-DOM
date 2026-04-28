"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getComplianceConfig,
  upsertComplianceConfig,
  addOverride,
  removeOverride,
  getResolvedConfig,
} from "@/lib/api/compliance-v3";
import type {
  ProjectComplianceConfig,
  ResolvedConfig,
} from "@/lib/api/compliance-v3.types";
import type { ApiError } from "@/lib/api/types";
import type { AddOverrideInput } from "@/lib/api/compliance-v3";

export interface UseComplianceConfigReturn {
  config: ProjectComplianceConfig | null;
  resolved: ResolvedConfig | null;
  loading: boolean;
  error: ApiError | null;
  fetchConfig: () => Promise<void>;
  upsert: (packIds: string[]) => Promise<void>;
  addConfigOverride: (data: AddOverrideInput) => Promise<void>;
  removeConfigOverride: (overrideId: string) => Promise<void>;
}

export function useComplianceConfig(
  projectId: string | null,
): UseComplianceConfigReturn {
  const [config, setConfig] = useState<ProjectComplianceConfig | null>(null);
  const [resolved, setResolved] = useState<ResolvedConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [cfg, res] = await Promise.all([
        getComplianceConfig(projectId),
        getResolvedConfig(projectId),
      ]);
      setConfig(cfg);
      setResolved(res);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const upsert = useCallback(
    async (packIds: string[]) => {
      if (!projectId) return;
      const result = await upsertComplianceConfig(projectId, { packIds });
      void result;
      await fetchConfig();
    },
    [projectId, fetchConfig],
  );

  const addConfigOverride = useCallback(
    async (data: AddOverrideInput) => {
      if (!projectId) return;
      await addOverride(projectId, data);
      await fetchConfig();
    },
    [projectId, fetchConfig],
  );

  const removeConfigOverride = useCallback(
    async (overrideId: string) => {
      if (!projectId) return;
      await removeOverride(projectId, overrideId);
      await fetchConfig();
    },
    [projectId, fetchConfig],
  );

  return {
    config,
    resolved,
    loading,
    error,
    fetchConfig,
    upsert,
    addConfigOverride,
    removeConfigOverride,
  };
}
