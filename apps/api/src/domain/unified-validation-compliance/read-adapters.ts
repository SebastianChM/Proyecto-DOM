import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  ComplianceRunWithRuleset,
  mapComplianceIssuesToUnified,
  mapComplianceRunsToUnified,
  mapValidationIssuesToUnified,
  mapValidationRunsToUnified,
} from "./mappers";
import { UnifiedIssue, UnifiedRun } from "./contract";

export interface ValidationRunReadFilters {
  projectId?: string;
  fileId?: string;
  userId?: string;
  status?: string;
  limit?: number;
}

export interface ValidationIssueReadFilters {
  runId: string;
  type?: string;
  status?: string;
  severity?: string;
}

export interface ComplianceRunReadFilters {
  projectId?: string;
  status?: string;
  rulesetId?: string;
  limit?: number;
}

export interface ComplianceIssueReadFilters {
  runId: string;
  severity?: string;
  status?: string;
  elementCategoryContains?: string;
}

export interface UnifiedReadAdapters {
  getValidationRunById(runId: string): Promise<UnifiedRun | null>;
  listValidationRuns(filters?: ValidationRunReadFilters): Promise<UnifiedRun[]>;
  listValidationIssues(filters: ValidationIssueReadFilters): Promise<UnifiedIssue[]>;
  getComplianceRunById(runId: string): Promise<UnifiedRun | null>;
  listComplianceRuns(filters?: ComplianceRunReadFilters): Promise<UnifiedRun[]>;
  listComplianceIssues(filters: ComplianceIssueReadFilters): Promise<UnifiedIssue[]>;
}

type UnifiedReadDataSource = Pick<
  PrismaClient,
  "validationRun" | "validationIssue" | "complianceRun" | "complianceIssue"
>;

const DEFAULT_VALIDATION_LIMIT = 50;
const DEFAULT_COMPLIANCE_LIMIT = 50;

function buildValidationRunWhere(
  filters: ValidationRunReadFilters,
): Prisma.ValidationRunWhereInput {
  const where: Prisma.ValidationRunWhereInput = {};

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.fileId) where.fileId = filters.fileId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.status) where.status = filters.status;

  return where;
}

function buildValidationIssueWhere(
  filters: ValidationIssueReadFilters,
): Prisma.ValidationIssueWhereInput {
  const where: Prisma.ValidationIssueWhereInput = {
    validationRunId: filters.runId,
  };

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.severity) where.severity = filters.severity;

  return where;
}

function buildComplianceRunWhere(
  filters: ComplianceRunReadFilters,
): Prisma.ComplianceRunWhereInput {
  const where: Prisma.ComplianceRunWhereInput = {};

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.rulesetId) where.rulesetId = filters.rulesetId;

  return where;
}

function buildComplianceIssueWhere(
  filters: ComplianceIssueReadFilters,
): Prisma.ComplianceIssueWhereInput {
  const where: Prisma.ComplianceIssueWhereInput = {
    runId: filters.runId,
  };

  if (filters.severity) where.severity = filters.severity;
  if (filters.status) where.status = filters.status;
  if (filters.elementCategoryContains) {
    where.elementCategory = { contains: filters.elementCategoryContains };
  }

  return where;
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (!value || value <= 0) return fallback;
  return value;
}

class PrismaUnifiedReadAdapters implements UnifiedReadAdapters {
  constructor(private readonly db: UnifiedReadDataSource) {}

  async getValidationRunById(runId: string): Promise<UnifiedRun | null> {
    const run = await this.db.validationRun.findUnique({ where: { id: runId } });
    if (!run) return null;
    return mapValidationRunsToUnified([run])[0];
  }

  async listValidationRuns(
    filters: ValidationRunReadFilters = {},
  ): Promise<UnifiedRun[]> {
    const runs = await this.db.validationRun.findMany({
      where: buildValidationRunWhere(filters),
      orderBy: { createdAt: "desc" },
      take: normalizeLimit(filters.limit, DEFAULT_VALIDATION_LIMIT),
    });

    return mapValidationRunsToUnified(runs);
  }

  async listValidationIssues(
    filters: ValidationIssueReadFilters,
  ): Promise<UnifiedIssue[]> {
    const issues = await this.db.validationIssue.findMany({
      where: buildValidationIssueWhere(filters),
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });

    return mapValidationIssuesToUnified(issues);
  }

  async getComplianceRunById(runId: string): Promise<UnifiedRun | null> {
    const run = await this.db.complianceRun.findUnique({
      where: { id: runId },
      include: {
        ruleset: {
          select: { name: true },
        },
      },
    });

    if (!run) return null;
    return mapComplianceRunsToUnified([run as ComplianceRunWithRuleset])[0];
  }

  async listComplianceRuns(
    filters: ComplianceRunReadFilters = {},
  ): Promise<UnifiedRun[]> {
    const runs = await this.db.complianceRun.findMany({
      where: buildComplianceRunWhere(filters),
      include: {
        ruleset: {
          select: { name: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: normalizeLimit(filters.limit, DEFAULT_COMPLIANCE_LIMIT),
    });

    return mapComplianceRunsToUnified(runs as ComplianceRunWithRuleset[]);
  }

  async listComplianceIssues(
    filters: ComplianceIssueReadFilters,
  ): Promise<UnifiedIssue[]> {
    const issues = await this.db.complianceIssue.findMany({
      where: buildComplianceIssueWhere(filters),
      orderBy: [{ severity: "asc" }, { elementCategory: "asc" }],
    });

    return mapComplianceIssuesToUnified(issues);
  }
}

export function createUnifiedReadAdapters(
  db: UnifiedReadDataSource,
): UnifiedReadAdapters {
  return new PrismaUnifiedReadAdapters(db);
}

export const unifiedReadAdapters = createUnifiedReadAdapters(prisma);
