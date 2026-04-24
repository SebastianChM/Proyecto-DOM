import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { cacheService } from "../../lib/redis";
import { conflict, badRequest, notFound } from "../../lib/errors";
import { env } from "../../config/env";
import { unitConversionService } from "../dictionary/unit-conversion.service";
import { projectComplianceConfigService } from "./project-config.service";
import { modelDerivativeService } from "../aps/model-derivative.service";
import { propertyDictionaryService } from "../dictionary/property-dictionary.service";
import { categoryDictionaryService } from "../dictionary/category-dictionary.service";
import {
  normalizeValue,
  matchElementsForRequirement,
  evaluateRequirement,
  calculateComplianceScore,
} from "../compliance-engine-v3";
import type {
  NormalizedElement,
  NormalizedValue,
  UnitConversionMap,
  PropertyResolver,
  ElementEvaluation,
} from "../compliance-engine-v3";
import type { PropertyEntry } from "../dictionary/types";
import type { ComplianceRun, ComplianceIssue } from "@prisma/client";
import type { PaginatedResponse } from "../../routes/compliance-v3/schemas";

const MODEL_ELEMENTS_TTL = 24 * 60 * 60;
export const EVALUATION_TIMEOUT_MS = 5 * 60 * 1000;

const RUN_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
} as const;

const ISSUE_STATUS = {
  OPEN: "OPEN",
} as const;

const ISSUE_SEVERITY_DB = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFO: "INFO",
} as const;

const SEVERITY_MAP: Record<string, string> = {
  MANDATORY: ISSUE_SEVERITY_DB.CRITICAL,
  RECOMMENDED: ISSUE_SEVERITY_DB.WARNING,
};

function modelCacheKey(modelUrn: string): string {
  return `compliance:model:${modelUrn}`;
}

export interface RunProgress {
  totalElements: number;
  processedElements: number;
  totalRequirements: number;
  complianceScore: number | null;
  issueCounts: {
    total: number;
    mandatory: number;
    recommended: number;
  };
  startedAt: string;
  completedAt: string | null;
}

export interface ComplianceRunWithMeta extends ComplianceRun {
  _count: { issues: number };
}

export interface IElementExtractor {
  extract(modelUrn: string, locale: string): Promise<NormalizedElement[]>;
}

export interface EvaluateOptions {
  discipline?: string;
  dryRun?: boolean;
}

export interface IComplianceRunnerV3Service {
  evaluate(
    projectId: string,
    modelUrn: string,
    options?: EvaluateOptions,
    userId?: string,
  ): Promise<{ runId: string }>;
  getRunById(runId: string): Promise<ComplianceRunWithMeta>;
  listRunsByProject(
    projectId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<ComplianceRun>>;
  getRunIssues(
    runId: string,
    filters: { severity?: string },
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<ComplianceIssue>>;
}

// Serialized form for Redis (Map is not JSON-serializable)
type SerializedElement = {
  elementId: string;
  name: string;
  category: string;
  properties: Array<[string, NormalizedValue]>;
};

// APS Model Properties API shapes
type ApsPropertyGroup = Record<string, string | number | boolean | null>;
type ApsPropertiesMap = Record<string, ApsPropertyGroup>;

interface ApsElement {
  objectid: number;
  name: string;
  externalId?: string;
  properties?: ApsPropertiesMap;
}

interface ApsModelPropertiesResponse {
  data: { type: string; collection: ApsElement[] };
}

function mapSeverityToDb(v3Severity: string): string {
  return SEVERITY_MAP[v3Severity.toUpperCase()] ?? ISSUE_SEVERITY_DB.INFO;
}

function makePropertyResolver(
  propertyEntries: PropertyEntry[],
): PropertyResolver {
  const aliasMap = new Map<string, string[]>(
    propertyEntries.map((e) => [e.canonicalName, e.aliases]),
  );

  return (element, canonicalName, conditionAliases) => {
    const dictAliases = aliasMap.get(canonicalName) ?? [];
    const allAliases = [...new Set([...conditionAliases, ...dictAliases])];

    if (element.properties.has(canonicalName)) {
      return element.properties.get(canonicalName)!;
    }

    for (const alias of allAliases) {
      const key = [...element.properties.keys()].find(
        (k) => k.toLowerCase() === alias.toLowerCase(),
      );
      if (key) return element.properties.get(key)!;
    }

    return null;
  };
}

class ApsElementExtractor implements IElementExtractor {
  async extract(
    modelUrn: string,
    locale: string,
  ): Promise<NormalizedElement[]> {
    const allConversions = await unitConversionService.getAll();
    const conversionMap: UnitConversionMap = new Map();
    for (const conv of allConversions) {
      conversionMap.set(conv.fromUnit, new Map([[conv.toUnit, conv.factor]]));
    }

    const response =
      await modelDerivativeService.getAllModelProperties(modelUrn);
    const apsResponse = response as unknown as ApsModelPropertiesResponse;
    const collection = apsResponse?.data?.collection ?? [];

    const elements: NormalizedElement[] = [];

    for (const apsEl of collection) {
      if (!apsEl.properties) continue;

      const identityGroup =
        apsEl.properties["Identity Data"] ??
        apsEl.properties["Datos de identidad"] ??
        {};
      const rawCategory = String(
        identityGroup["Category"] ?? identityGroup["Categoría"] ?? "Unknown",
      );

      const categoryEntry = await categoryDictionaryService.resolve(
        rawCategory,
        locale,
      );
      const category = categoryEntry?.canonicalName ?? rawCategory;

      const properties = new Map<string, NormalizedValue>();
      for (const group of Object.values(apsEl.properties)) {
        for (const [propName, propValue] of Object.entries(group)) {
          if (propValue === null || propValue === undefined) continue;
          const rawStr = String(propValue);
          const unitMatch = rawStr.match(/^(-?[\d.]+)\s*([a-zA-Z°'"/%]+)$/);
          const unit = unitMatch ? unitMatch[2] : null;
          const normalized = normalizeValue(rawStr, unit, conversionMap);
          properties.set(propName, normalized);
        }
      }

      elements.push({
        elementId: String(apsEl.objectid),
        name: apsEl.name,
        category,
        properties,
      });
    }

    return elements;
  }
}

export class ComplianceRunnerV3Service implements IComplianceRunnerV3Service {
  private readonly extractor: IElementExtractor;

  constructor(extractor?: IElementExtractor) {
    this.extractor = extractor ?? new ApsElementExtractor();
  }

  async evaluate(
    projectId: string,
    modelUrn: string,
    options: EvaluateOptions = {},
    userId?: string,
  ): Promise<{ runId: string }> {
    const { discipline, dryRun = false } = options;

    // Step 1: Check for concurrent RUNNING run
    const running = await prisma.complianceRun.findFirst({
      where: { projectId, status: RUN_STATUS.RUNNING },
      select: { id: true },
    });
    if (running) {
      throw conflict(
        `Evaluation already running for project ${projectId}`,
        "EVALUATION_ALREADY_RUNNING",
      );
    }

    // Step 2: Get compliance config
    const config = await projectComplianceConfigService.getConfig(projectId);
    if (!config) {
      throw badRequest(
        `No compliance config found for project ${projectId}`,
        "NO_COMPLIANCE_CONFIG",
      );
    }
    const configId = (config as { id: string }).id;

    // Step 3: Create run in PENDING
    const run = await prisma.complianceRun.create({
      data: {
        projectId,
        configId,
        modelUrn,
        status: RUN_STATUS.PENDING,
        createdBy: userId ?? null,
      },
    });

    logger.info("[ComplianceRunnerV3] Run created", {
      runId: run.id,
      projectId,
      modelUrn,
      dryRun,
    });

    // Step 4: Transition to RUNNING with initial progress
    const startedAt = new Date().toISOString();
    const initialProgress: RunProgress = {
      totalElements: 0,
      processedElements: 0,
      totalRequirements: 0,
      complianceScore: null,
      issueCounts: { total: 0, mandatory: 0, recommended: 0 },
      startedAt,
      completedAt: null,
    };

    await prisma.complianceRun.update({
      where: { id: run.id },
      data: { status: RUN_STATUS.RUNNING, metadata: initialProgress as object },
    });

    // Steps 5–9: Execute synchronous pipeline
    try {
      await this._executePipeline(
        run.id,
        projectId,
        modelUrn,
        discipline,
        dryRun,
        startedAt,
      );
    } catch (pipelineErr) {
      logger.error("[ComplianceRunnerV3] Unexpected pipeline error", {
        runId: run.id,
        error: (pipelineErr as Error).message,
      });
      await prisma.complianceRun
        .update({ where: { id: run.id }, data: { status: RUN_STATUS.ERROR } })
        .catch((e: unknown) => {
          logger.error(
            "[ComplianceRunnerV3] Failed to update run status to ERROR",
            {
              runId: run.id,
              error: (e as Error).message,
            },
          );
        });
    }

    return { runId: run.id };
  }

  private async _executePipeline(
    runId: string,
    projectId: string,
    modelUrn: string,
    discipline: string | undefined,
    dryRun: boolean,
    startedAt: string,
  ): Promise<void> {
    const pipelineStart = Date.now();
    const locale = env.DEFAULT_LOCALE;

    // Step 5: Resolve requirements
    let requirements =
      await projectComplianceConfigService.getResolved(projectId);
    if (discipline) {
      requirements = requirements.filter(
        (r) => r.discipline.toLowerCase() === discipline.toLowerCase(),
      );
    }

    const propertyEntries = await propertyDictionaryService.getAll(locale);
    const resolver = makePropertyResolver(propertyEntries);

    // Step 6: Extract elements (with Redis cache)
    const cacheKey = modelCacheKey(modelUrn);
    let elements: NormalizedElement[];

    const cached = await cacheService.get<SerializedElement[]>(cacheKey);
    if (cached) {
      elements = cached.map((s) => ({
        ...s,
        properties: new Map(s.properties),
      }));
      logger.debug("[ComplianceRunnerV3] Elements from cache", {
        modelUrn,
        count: elements.length,
      });
    } else {
      try {
        elements = await this.extractor.extract(modelUrn, locale);
        const serialized: SerializedElement[] = elements.map((el) => ({
          ...el,
          properties: [...el.properties.entries()],
        }));
        await cacheService.set(cacheKey, serialized, MODEL_ELEMENTS_TTL);
        logger.info("[ComplianceRunnerV3] Elements extracted and cached", {
          modelUrn,
          count: elements.length,
        });
      } catch (extractErr) {
        logger.error("[ComplianceRunnerV3] Element extraction failed", {
          runId,
          modelUrn,
          error: (extractErr as Error).message,
        });
        const members = await prisma.projectMember.findMany({
          where: { projectId },
          select: { userId: true },
        });
        await prisma.$transaction([
          prisma.complianceRun.update({
            where: { id: runId },
            data: { status: RUN_STATUS.ERROR },
          }),
          ...members.map((m) =>
            prisma.notification.create({
              data: {
                userId: m.userId,
                type: "COMPLIANCE_RUN_ERROR",
                title: "Compliance evaluation failed",
                message: "Element extraction from APS failed",
                complianceRunId: runId,
              },
            }),
          ),
        ]);
        return;
      }
    }

    // Update progress with totals
    await prisma.complianceRun.update({
      where: { id: runId },
      data: {
        metadata: {
          totalElements: elements.length,
          processedElements: 0,
          totalRequirements: requirements.length,
          complianceScore: null,
          issueCounts: { total: 0, mandatory: 0, recommended: 0 },
          startedAt,
          completedAt: null,
        } as object,
      },
    });

    // Step 7: Match and evaluate with timeout check
    const evaluations: ElementEvaluation[] = [];
    for (const req of requirements) {
      if (Date.now() - pipelineStart > EVALUATION_TIMEOUT_MS) {
        logger.warn("[ComplianceRunnerV3] Evaluation timeout exceeded", {
          runId,
          projectId,
        });
        await prisma.complianceRun.update({
          where: { id: runId },
          data: { status: RUN_STATUS.TIMEOUT },
        });
        return;
      }

      const matching = matchElementsForRequirement(req, elements);
      for (const element of matching) {
        const result = evaluateRequirement(req, element, resolver);
        evaluations.push(result);
      }
    }

    // Step 8 & 9: Persist results and notify in a single $transaction
    const score = calculateComplianceScore(evaluations);
    const failedEvaluations = evaluations.filter(
      (e) => e.status === "FAIL" || e.status === "ERROR",
    );
    const mandatoryCount = failedEvaluations.filter(
      (e) => e.severity.toUpperCase() === "MANDATORY",
    ).length;
    const recommendedCount = failedEvaluations.filter(
      (e) => e.severity.toUpperCase() === "RECOMMENDED",
    ).length;

    const finalProgress: RunProgress = {
      totalElements: elements.length,
      processedElements: elements.length,
      totalRequirements: requirements.length,
      complianceScore: score,
      issueCounts: {
        total: failedEvaluations.length,
        mandatory: mandatoryCount,
        recommended: recommendedCount,
      },
      startedAt,
      completedAt: new Date().toISOString(),
    };

    if (!dryRun) {
      const members = await prisma.projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });

      const notifTitle = "Compliance evaluation completed";
      const notifMessage = `Score: ${score}%, ${mandatoryCount} mandatory issues found`;

      await prisma.$transaction(async (tx) => {
        for (const evaluation of failedEvaluations) {
          const failCondition = evaluation.conditions.find((c) => !c.passed);
          await tx.complianceIssue.create({
            data: {
              runId,
              ruleName: evaluation.requirementCode,
              ruleId: evaluation.requirementId,
              elementId: evaluation.elementId,
              elementName: evaluation.elementName,
              elementCategory: evaluation.elementCategory,
              propertyName: failCondition?.propertyName ?? "N/A",
              expectedValue: failCondition?.expectedValue ?? "N/A",
              actualValue: failCondition?.actualValue ?? "N/A",
              deviation:
                failCondition?.deviation !== null &&
                failCondition?.deviation !== undefined
                  ? String(failCondition.deviation)
                  : null,
              severity: mapSeverityToDb(evaluation.severity),
              status: ISSUE_STATUS.OPEN,
              legalReference: evaluation.legalReference,
            },
          });
        }

        await tx.complianceRun.update({
          where: { id: runId },
          data: {
            status: RUN_STATUS.COMPLETED,
            metadata: finalProgress as object,
          },
        });

        for (const member of members) {
          await tx.notification.create({
            data: {
              userId: member.userId,
              type: "COMPLIANCE_RUN_COMPLETED",
              title: notifTitle,
              message: notifMessage,
              complianceRunId: runId,
            },
          });
        }
      });

      logger.info("[ComplianceRunnerV3] Run completed", {
        runId,
        projectId,
        score,
        issueCount: failedEvaluations.length,
      });
    } else {
      await prisma.complianceRun.update({
        where: { id: runId },
        data: {
          status: RUN_STATUS.COMPLETED,
          metadata: finalProgress as object,
        },
      });
      logger.info("[ComplianceRunnerV3] Dry run completed", {
        runId,
        projectId,
        score,
      });
    }
  }

  async getRunById(runId: string): Promise<ComplianceRunWithMeta> {
    const run = await prisma.complianceRun.findUnique({
      where: { id: runId },
      include: { _count: { select: { issues: true } } },
    });
    if (!run) {
      throw notFound(
        `ComplianceRun not found: ${runId}`,
        "COMPLIANCE_RUN_NOT_FOUND",
      );
    }
    return run as ComplianceRunWithMeta;
  }

  async listRunsByProject(
    projectId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<ComplianceRun>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.complianceRun.findMany({
        where: { projectId },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.complianceRun.count({ where: { projectId } }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRunIssues(
    runId: string,
    filters: { severity?: string },
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<ComplianceIssue>> {
    const run = await prisma.complianceRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) {
      throw notFound(
        `ComplianceRun not found: ${runId}`,
        "COMPLIANCE_RUN_NOT_FOUND",
      );
    }

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: { runId: string; severity?: string } = {
      runId,
      ...(filters.severity && { severity: mapSeverityToDb(filters.severity) }),
    };

    const [data, total] = await Promise.all([
      prisma.complianceIssue.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.complianceIssue.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const complianceRunnerV3Service = new ComplianceRunnerV3Service();
