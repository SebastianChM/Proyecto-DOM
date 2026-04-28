import crypto from "crypto";
import prisma from "../../lib/prisma";
import { cacheService } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { notFound, badRequest } from "../../lib/errors";
import { defaultSuggester } from "../requirement-suggester";
import { requirementService } from "./requirement.service";
import { env } from "../../config/env";
import type { IRequirementSuggester } from "../requirement-suggester/requirement-suggester.interface";
import type {
  StoredSuggestion,
  SuggestedRequirement,
} from "../requirement-suggester/types";
import type { CreateRequirementInput } from "../../routes/compliance-v3/schemas";

// dictionary services — lazy import to avoid circular deps at module init
import { propertyDictionaryService } from "../dictionary/property-dictionary.service";
import { categoryDictionaryService } from "../dictionary/category-dictionary.service";

const SUGGESTION_TTL = 24 * 60 * 60; // 24 hours in seconds

function suggestionKey(analysisId: string): string {
  return `suggestion:${analysisId}`;
}

export interface AnalyzeResult {
  analysisId: string;
  suggestions: SuggestedRequirement[];
  count: number;
}

export interface ApproveResult {
  requirementId: string;
}

export interface ISuggestionService {
  analyze(
    packId: string,
    text: string,
    userId?: string,
    disciplineFilter?: string,
  ): Promise<AnalyzeResult>;

  approve(
    analysisId: string,
    index: number,
    userId?: string,
  ): Promise<ApproveResult>;

  reject(analysisId: string): Promise<void>;
}

export class SuggestionService implements ISuggestionService {
  constructor(
    private readonly suggester: IRequirementSuggester = defaultSuggester,
  ) {}

  /**
   * Analyse a regulatory text against a regulation pack, returning LLM-generated
   * requirement suggestions stored transiently in Redis (TTL 24 h).
   */
  async analyze(
    packId: string,
    text: string,
    userId?: string,
    disciplineFilter?: string,
  ): Promise<AnalyzeResult> {
    // 1. Verify pack exists and is not DEPRECATED
    const pack = await prisma.regulationPack.findUnique({
      where: { id: packId },
      select: { id: true, status: true },
    });

    if (!pack) {
      throw notFound(`RegulationPack not found: ${packId}`, "PACK_NOT_FOUND");
    }

    if (pack.status === "DEPRECATED") {
      throw badRequest(
        "Cannot analyse against a deprecated pack",
        "PACK_DEPRECATED",
      );
    }

    // 2. Fetch dictionary context
    const locale = env.DEFAULT_LOCALE;
    const [properties, categories] = await Promise.all([
      propertyDictionaryService.getAll(locale),
      categoryDictionaryService.getAll(locale),
    ]);

    // 3. Run suggester
    const suggestions = await this.suggester.suggest(
      text,
      properties,
      categories,
      disciplineFilter,
    );

    // 4. Store in Redis
    const analysisId = crypto.randomUUID();
    const stored: StoredSuggestion = {
      analysisId,
      packId,
      suggestions,
      createdAt: new Date().toISOString(),
      userId,
      disciplineFilter,
    };

    try {
      await cacheService.set(suggestionKey(analysisId), stored, SUGGESTION_TTL);
    } catch (cacheError: unknown) {
      logger.warn(
        "[SuggestionService] Failed to cache analysis — suggestions will not be approvable",
        {
          analysisId,
          error:
            cacheError instanceof Error
              ? cacheError.message
              : String(cacheError),
        },
      );
    }

    logger.info("[SuggestionService] Analysis complete", {
      analysisId,
      packId,
      count: suggestions.length,
      userId,
    });

    return { analysisId, suggestions, count: suggestions.length };
  }

  /**
   * Approve one suggestion from an analysis — creates a DRAFT requirement in the pack.
   */
  async approve(
    analysisId: string,
    index: number,
    userId?: string,
  ): Promise<ApproveResult> {
    const stored = await cacheService.get<StoredSuggestion>(
      suggestionKey(analysisId),
    );

    if (!stored) {
      throw notFound(
        `Analysis not found or expired: ${analysisId}`,
        "ANALYSIS_NOT_FOUND",
      );
    }

    if (index < 0 || index >= stored.suggestions.length) {
      throw badRequest(
        `Index ${index} is out of bounds (${stored.suggestions.length} suggestions)`,
        "SUGGESTION_INDEX_OUT_OF_BOUNDS",
      );
    }

    const suggestion = stored.suggestions[index];

    // Build a provisional unique code that satisfies the pattern ^[A-Z]{2}-[A-Z0-9-]+-R\d{3}$
    const shortId = stored.packId
      .replace(/-/g, "")
      .substring(0, 6)
      .toUpperCase();
    const suffix = String(crypto.randomInt(0, 1000)).padStart(3, "0");
    const code = `SG-${shortId}-R${suffix}`;

    const input: CreateRequirementInput = {
      code,
      description: suggestion.description,
      legalReference: suggestion.legalReference,
      discipline: suggestion.discipline,
      severity: suggestion.severity,
      tags: [],
      notes: `Auto-generated by LLM analysis (analysisId=${analysisId}, confidence=${suggestion.confidence})`,
      conditions: suggestion.conditions.map((c, i) => ({
        propertyRef: c.property,
        operator:
          c.operator as CreateRequirementInput["conditions"][number]["operator"],
        value: c.value,
        unit: c.unit ?? undefined,
        logicGroup: "AND" as const,
        sortOrder: i,
      })),
      applicability:
        suggestion.applicability.categories.length > 0
          ? {
              targetCategories: suggestion.applicability.categories,
              excludeCategories: [],
              scope: "FILTERED" as const,
            }
          : undefined,
    };

    const requirement = (await requirementService.create(
      stored.packId,
      input,
      userId,
    )) as { id: string };

    logger.info("[SuggestionService] Requirement created from suggestion", {
      analysisId,
      requirementId: requirement.id,
      packId: stored.packId,
    });

    return { requirementId: requirement.id };
  }

  /**
   * Reject an analysis. The Redis entry remains until TTL expiry.
   */
  async reject(analysisId: string): Promise<void> {
    const stored = await cacheService.get<StoredSuggestion>(
      suggestionKey(analysisId),
    );
    if (!stored) {
      throw notFound(`Analysis not found: ${analysisId}`, "ANALYSIS_NOT_FOUND");
    }
    logger.info("[SuggestionService] Analysis rejected", { analysisId });
    // TTL in Redis handles cleanup — no explicit delete required.
  }
}

export const suggestionService = new SuggestionService();
