import prisma from "../../lib/prisma";
import { cacheService } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { notFound } from "../../lib/errors";
import type { PropertyEntry, IPropertyDictionaryService } from "./types";

const CACHE_TTL = 3600; // 1 hour — dictionary data changes rarely
const CACHE_PREFIX = "dict:property";

export class PropertyDictionaryService implements IPropertyDictionaryService {
  /**
   * Resolve a raw property name to its canonical dictionary entry.
   * Searches by exact canonicalName, displayName, or alias (case-insensitive).
   */
  async resolve(
    rawName: string,
    locale: string,
  ): Promise<PropertyEntry | null> {
    const cacheKey = `${CACHE_PREFIX}:resolve:${locale}:${rawName.toLowerCase()}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const lower = rawName.toLowerCase();

        // 1. Exact match on canonicalName or displayName
        const exact = await prisma.propertyDictionary.findFirst({
          where: {
            locale,
            OR: [
              { canonicalName: { equals: rawName, mode: "insensitive" } },
              { displayName: { equals: rawName, mode: "insensitive" } },
            ],
          },
        });
        if (exact) return exact as PropertyEntry;

        // 2. Search in aliases — Prisma doesn't support case-insensitive array search,
        //    so we fetch all for the locale and search in-memory
        const all = await prisma.propertyDictionary.findMany({
          where: { locale },
        });

        const aliasMatch = all.find((entry) =>
          entry.aliases.some((alias) => alias.toLowerCase() === lower),
        );

        return (aliasMatch as PropertyEntry) ?? null;
      },
      CACHE_TTL,
    );
  }

  /**
   * Get a specific property by its canonical name and locale.
   * Throws NotFound if not found.
   */
  async getByCanonical(
    canonicalName: string,
    locale: string,
  ): Promise<PropertyEntry> {
    const cacheKey = `${CACHE_PREFIX}:canonical:${locale}:${canonicalName}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const entry = await prisma.propertyDictionary.findUnique({
          where: { canonicalName_locale: { canonicalName, locale } },
        });

        if (!entry) {
          throw notFound(
            `Property "${canonicalName}" not found for locale "${locale}"`,
            "PROPERTY_NOT_FOUND",
          );
        }

        return entry as PropertyEntry;
      },
      CACHE_TTL,
    );
  }

  /**
   * Get all property entries for a locale.
   */
  async getAll(locale: string): Promise<PropertyEntry[]> {
    const cacheKey = `${CACHE_PREFIX}:all:${locale}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const entries = await prisma.propertyDictionary.findMany({
          where: { locale },
          orderBy: { canonicalName: "asc" },
        });

        logger.debug("[PropertyDictionary] Loaded entries", {
          locale,
          count: entries.length,
        });

        return entries as PropertyEntry[];
      },
      CACHE_TTL,
    );
  }
}

export const propertyDictionaryService = new PropertyDictionaryService();
