"use client";

import { useState, useEffect } from "react";
import {
  getProperties,
  getCategories,
  getUnits,
} from "@/lib/api/compliance-v3";
import type {
  PropertyEntry,
  CategoryEntry,
  UnitConversion,
} from "@/lib/api/compliance-v3.types";
import type { ApiError } from "@/lib/api/types";

let cache: {
  properties: PropertyEntry[];
  categories: CategoryEntry[];
  units: UnitConversion[];
} | null = null;

export interface UseDictionariesReturn {
  properties: PropertyEntry[];
  categories: CategoryEntry[];
  units: UnitConversion[];
  loading: boolean;
  error: ApiError | null;
}

export function useDictionaries(): UseDictionariesReturn {
  const [properties, setProperties] = useState<PropertyEntry[]>(
    cache?.properties ?? [],
  );
  const [categories, setCategories] = useState<CategoryEntry[]>(
    cache?.categories ?? [],
  );
  const [units, setUnits] = useState<UnitConversion[]>(cache?.units ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (cache !== null) return;

    let cancelled = false;

    Promise.all([getProperties(), getCategories(), getUnits()])
      .then(([props, cats, unitList]) => {
        if (cancelled) return;
        cache = { properties: props, categories: cats, units: unitList };
        setProperties(props);
        setCategories(cats);
        setUnits(unitList);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { properties, categories, units, loading, error };
}
