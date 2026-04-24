import prisma from "../../lib/prisma";
import { cacheService } from "../../lib/redis";
import { logger } from "../../lib/logger";
import type { CategoryEntry, ICategoryDictionaryService } from "./types";

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = "dict:category";

export class CategoryDictionaryService implements ICategoryDictionaryService {
  /**
   * Resolve a raw category name to its canonical dictionary entry.
   * Searches by exact canonicalName, displayName, revitCategory, or alias (case-insensitive).
   */
  async resolve(
    rawCategory: string,
    locale: string,
  ): Promise<CategoryEntry | null> {
    const cacheKey = `${CACHE_PREFIX}:resolve:${locale}:${rawCategory.toLowerCase()}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const lower = rawCategory.toLowerCase();

        // 1. Exact match on canonicalName, displayName, or revitCategory
        const exact = await prisma.categoryDictionary.findFirst({
          where: {
            locale,
            OR: [
              { canonicalName: { equals: rawCategory, mode: "insensitive" } },
              { displayName: { equals: rawCategory, mode: "insensitive" } },
              { revitCategory: { equals: rawCategory, mode: "insensitive" } },
            ],
          },
        });
        if (exact) return exact as CategoryEntry;

        // 2. Search in aliases (in-memory, case-insensitive)
        const all = await prisma.categoryDictionary.findMany({
          where: { locale },
        });

        const aliasMatch = all.find((entry) =>
          entry.aliases.some((alias) => alias.toLowerCase() === lower),
        );

        return (aliasMatch as CategoryEntry) ?? null;
      },
      CACHE_TTL,
    );
  }

  /**
   * Get all category entries for a locale.
   */
  async getAll(locale: string): Promise<CategoryEntry[]> {
    const cacheKey = `${CACHE_PREFIX}:all:${locale}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const entries = await prisma.categoryDictionary.findMany({
          where: { locale },
          orderBy: { canonicalName: "asc" },
        });

        logger.debug("[CategoryDictionary] Loaded entries", {
          locale,
          count: entries.length,
        });

        return entries as CategoryEntry[];
      },
      CACHE_TTL,
    );
  }
}

export const categoryDictionaryService = new CategoryDictionaryService();
