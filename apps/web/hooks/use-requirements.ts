"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getRequirements,
  getRequirementById,
  createRequirement,
  updateRequirement,
  verifyRequirement,
  deleteRequirement,
  bulkCreateRequirements,
} from "@/lib/api/compliance-v3";
import type {
  Requirement,
  V3PaginatedResponse,
} from "@/lib/api/compliance-v3.types";
import type { ApiError } from "@/lib/api/types";
import type {
  RequirementListParams,
  CreateRequirementInput,
} from "@/lib/api/compliance-v3";

export interface UseRequirementListReturn {
  requirements: Requirement[];
  pagination: V3PaginatedResponse<Requirement>["pagination"] | null;
  loading: boolean;
  error: ApiError | null;
  params: RequirementListParams;
  fetchRequirements: (p?: RequirementListParams) => Promise<void>;
  refresh: () => void;
  setPage: (page: number) => void;
  setFilters: (
    filters: Pick<RequirementListParams, "discipline" | "status" | "severity">,
  ) => void;
}

export interface UseRequirementDetailReturn {
  requirement: Requirement | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

export interface UseRequirementMutationsReturn {
  create: (data: CreateRequirementInput) => Promise<Requirement>;
  update: (
    id: string,
    data: Partial<CreateRequirementInput>,
  ) => Promise<Requirement>;
  verify: (id: string, userId: string) => Promise<Requirement>;
  remove: (id: string) => Promise<void>;
  bulkCreate: (
    requirements: CreateRequirementInput[],
  ) => Promise<Requirement[]>;
}

export function useRequirementList(
  packId: string | null,
  initialParams?: RequirementListParams,
): UseRequirementListReturn {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [pagination, setPagination] = useState<
    V3PaginatedResponse<Requirement>["pagination"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [params, setParams] = useState<RequirementListParams>(
    initialParams ?? {},
  );

  const fetchRequirements = useCallback(
    async (p?: RequirementListParams) => {
      if (!packId) return;
      setLoading(true);
      setError(null);
      try {
        const resolved = p ?? params;
        const result = await getRequirements(packId, resolved);
        setRequirements(result.data);
        setPagination(result.pagination);
        if (p) setParams(p);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setLoading(false);
      }
    },
    [packId, params],
  );

  useEffect(() => {
    fetchRequirements(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  const refresh = useCallback(() => {
    fetchRequirements(params);
  }, [fetchRequirements, params]);

  const setPage = useCallback(
    (page: number) => {
      const next = { ...params, page };
      setParams(next);
      fetchRequirements(next);
    },
    [fetchRequirements, params],
  );

  const setFilters = useCallback(
    (
      filters: Pick<
        RequirementListParams,
        "discipline" | "status" | "severity"
      >,
    ) => {
      const next = { ...params, ...filters, page: 1 };
      setParams(next);
      fetchRequirements(next);
    },
    [fetchRequirements, params],
  );

  return {
    requirements,
    pagination,
    loading,
    error,
    params,
    fetchRequirements,
    refresh,
    setPage,
    setFilters,
  };
}

export function useRequirementDetail(
  requirementId: string | null,
): UseRequirementDetailReturn {
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchRequirement = useCallback(async () => {
    if (!requirementId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRequirementById(requirementId);
      setRequirement(result);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => {
    fetchRequirement();
  }, [fetchRequirement]);

  return { requirement, loading, error, refresh: fetchRequirement };
}

export function useRequirementMutations(
  packId: string,
): UseRequirementMutationsReturn {
  const create = useCallback(
    async (data: CreateRequirementInput): Promise<Requirement> => {
      try {
        const result = await createRequirement(packId, data);
        toast.success(`Requirement "${result.code}" created`);
        return result;
      } catch (err) {
        toast.error("Failed to create requirement");
        throw err as ApiError;
      }
    },
    [packId],
  );

  const update = useCallback(
    async (
      id: string,
      data: Partial<CreateRequirementInput>,
    ): Promise<Requirement> => {
      try {
        const result = await updateRequirement(id, data);
        toast.success(`Requirement "${result.code}" updated`);
        return result;
      } catch (err) {
        toast.error("Failed to update requirement");
        throw err as ApiError;
      }
    },
    [],
  );

  const verify = useCallback(
    async (id: string, userId: string): Promise<Requirement> => {
      try {
        const result = await verifyRequirement(id, userId);
        toast.success(`Requirement "${result.code}" verified`);
        return result;
      } catch (err) {
        toast.error("Failed to verify requirement");
        throw err as ApiError;
      }
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteRequirement(id);
      toast.success("Requirement deleted");
    } catch (err) {
      toast.error("Failed to delete requirement");
      throw err as ApiError;
    }
  }, []);

  const bulkCreate = useCallback(
    async (requirements: CreateRequirementInput[]): Promise<Requirement[]> => {
      try {
        const result = await bulkCreateRequirements(packId, requirements);
        toast.success(`${result.length} requirements created`);
        return result;
      } catch (err) {
        toast.error("Failed to bulk create requirements");
        throw err as ApiError;
      }
    },
    [packId],
  );

  return { create, update, verify, remove, bulkCreate };
}
