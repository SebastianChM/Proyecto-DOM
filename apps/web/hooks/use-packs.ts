"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getPacks,
  getPackById,
  createPack,
  updatePack,
  publishPack,
  deprecatePack,
} from "@/lib/api/compliance-v3";
import type {
  Pack,
  PackDetail,
  V3PaginatedResponse,
} from "@/lib/api/compliance-v3.types";
import type { ApiError } from "@/lib/api/types";
import type {
  PackListParams,
  CreatePackInput,
  UpdatePackInput,
} from "@/lib/api/compliance-v3";

export interface UsePackListReturn {
  packs: Pack[];
  pagination: V3PaginatedResponse<Pack>["pagination"] | null;
  loading: boolean;
  error: ApiError | null;
  params: PackListParams;
  fetchPacks: (p?: PackListParams) => Promise<void>;
  refresh: () => void;
  setPage: (page: number) => void;
}

export interface UsePackDetailReturn {
  pack: PackDetail | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

export interface UsePackMutationsReturn {
  create: (data: CreatePackInput) => Promise<Pack>;
  update: (id: string, data: UpdatePackInput) => Promise<Pack>;
  publish: (id: string) => Promise<Pack>;
  deprecate: (id: string) => Promise<Pack>;
}

export function usePackList(initialParams?: PackListParams): UsePackListReturn {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [pagination, setPagination] = useState<
    V3PaginatedResponse<Pack>["pagination"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [params, setParams] = useState<PackListParams>(initialParams ?? {});

  const fetchPacks = useCallback(
    async (p?: PackListParams) => {
      setLoading(true);
      setError(null);
      try {
        const resolved = p ?? params;
        const result = await getPacks(resolved);
        setPacks(result.data);
        setPagination(result.pagination);
        if (p) setParams(p);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setLoading(false);
      }
    },
    [params],
  );

  useEffect(() => {
    fetchPacks(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    fetchPacks(params);
  }, [fetchPacks, params]);

  const setPage = useCallback(
    (page: number) => {
      const next = { ...params, page };
      setParams(next);
      fetchPacks(next);
    },
    [fetchPacks, params],
  );

  return {
    packs,
    pagination,
    loading,
    error,
    params,
    fetchPacks,
    refresh,
    setPage,
  };
}

export function usePackDetail(packId: string | null): UsePackDetailReturn {
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchPack = useCallback(async () => {
    if (!packId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPackById(packId);
      setPack(result);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    fetchPack();
  }, [fetchPack]);

  return { pack, loading, error, refresh: fetchPack };
}

export function usePackMutations(): UsePackMutationsReturn {
  const create = useCallback(async (data: CreatePackInput): Promise<Pack> => {
    try {
      const result = await createPack(data);
      toast.success(`Pack "${result.name}" created successfully`);
      return result;
    } catch (err) {
      throw err as ApiError;
    }
  }, []);

  const update = useCallback(
    async (id: string, data: UpdatePackInput): Promise<Pack> => {
      try {
        const result = await updatePack(id, data);
        toast.success(`Pack updated successfully`);
        return result;
      } catch (err) {
        throw err as ApiError;
      }
    },
    [],
  );

  const publish = useCallback(async (id: string): Promise<Pack> => {
    try {
      const result = await publishPack(id);
      toast.success(`Pack "${result.name}" published`);
      return result;
    } catch (err) {
      throw err as ApiError;
    }
  }, []);

  const deprecate = useCallback(async (id: string): Promise<Pack> => {
    try {
      const result = await deprecatePack(id);
      toast.success(`Pack "${result.name}" deprecated`);
      return result;
    } catch (err) {
      throw err as ApiError;
    }
  }, []);

  return { create, update, publish, deprecate };
}
