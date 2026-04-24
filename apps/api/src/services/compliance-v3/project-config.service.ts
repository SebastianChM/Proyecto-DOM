import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { auditService } from "../audit.service";
import { notFound, badRequest, conflict } from "../../lib/errors";
import { cacheService } from "../../lib/redis";
import {
  PACK_STATUSES,
  OVERRIDE_ACTIONS,
} from "../../routes/compliance-v3/schemas";
import type {
  UpsertConfigInput,
  AddOverrideInput,
} from "../../routes/compliance-v3/schemas";

const CONFIG_CACHE_TTL = 30 * 60; // 30 minutes

function configCacheKey(projectId: string): string {
  return `compliance:config:${projectId}`;
}

export interface ResolvedRequirement {
  id: string;
  code: string;
  packId: string;
  description: string;
  legalReference: string;
  discipline: string;
  severity: string;
  tags: string[];
  notes: string | null;
  status: string;
  conditions: unknown[];
  applicability: unknown;
  overridden: boolean;
  overrideReason?: string;
  overrideAction?: string;
  overrideNewValue?: string;
  overrideNewSeverity?: string;
}

export interface IProjectComplianceConfigService {
  getConfig(projectId: string): Promise<unknown | null>;
  upsertConfig(
    projectId: string,
    data: UpsertConfigInput,
    userId?: string,
  ): Promise<unknown>;
  addOverride(
    projectId: string,
    data: AddOverrideInput,
    userId?: string,
  ): Promise<unknown>;
  removeOverride(overrideId: string, userId?: string): Promise<void>;
  getResolved(projectId: string): Promise<ResolvedRequirement[]>;
}

export class ProjectComplianceConfigService implements IProjectComplianceConfigService {
  async getConfig(projectId: string): Promise<unknown | null> {
    const cached = await cacheService.get<unknown>(configCacheKey(projectId));
    if (cached) return cached;

    const config = await prisma.projectComplianceConfig.findUnique({
      where: { projectId },
      include: {
        packs: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            country: true,
            version: true,
            scope: true,
          },
        },
        overrides: {
          include: {
            requirement: {
              select: { id: true, code: true, description: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (config) {
      await cacheService.set(
        configCacheKey(projectId),
        config,
        CONFIG_CACHE_TTL,
      );
    }

    return config;
  }

  async upsertConfig(
    projectId: string,
    data: UpsertConfigInput,
    userId?: string,
  ): Promise<unknown> {
    const { packIds } = data;

    const packs = await prisma.regulationPack.findMany({
      where: { id: { in: packIds } },
      select: { id: true, status: true, code: true },
    });

    if (packs.length !== packIds.length) {
      const foundIds = packs.map((p) => p.id);
      const missing = packIds.filter((id) => !foundIds.includes(id));
      throw notFound(
        `RegulationPack(s) not found: ${missing.join(", ")}`,
        "PACK_NOT_FOUND",
      );
    }

    const nonPublished = packs.filter(
      (p) => p.status !== PACK_STATUSES.PUBLISHED,
    );
    if (nonPublished.length > 0) {
      throw badRequest(
        `Packs must be PUBLISHED. Non-published packs: ${nonPublished.map((p) => p.code).join(", ")}`,
        "PACK_NOT_PUBLISHED",
      );
    }

    const config = await prisma.$transaction(async (tx) => {
      const existing = await tx.projectComplianceConfig.findUnique({
        where: { projectId },
        select: { id: true },
      });

      if (existing) {
        return tx.projectComplianceConfig.update({
          where: { projectId },
          data: {
            packs: { set: packIds.map((id) => ({ id })) },
          },
          include: {
            packs: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
                country: true,
                version: true,
                scope: true,
              },
            },
            overrides: {
              include: {
                requirement: {
                  select: { id: true, code: true, description: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });
      }

      return tx.projectComplianceConfig.create({
        data: {
          projectId,
          packs: { connect: packIds.map((id) => ({ id })) },
        },
        include: {
          packs: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              country: true,
              version: true,
              scope: true,
            },
          },
          overrides: {
            include: {
              requirement: {
                select: { id: true, code: true, description: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });

    await cacheService.del(configCacheKey(projectId));

    await auditService.log({
      userId,
      action: "UPSERT",
      entity: "ProjectComplianceConfig",
      entityId: config.id,
      details: { projectId, packIds },
    });

    logger.info("[ProjectConfig] Upserted config", {
      id: config.id,
      projectId,
      packCount: packIds.length,
    });

    return config;
  }

  async addOverride(
    projectId: string,
    data: AddOverrideInput,
    userId?: string,
  ): Promise<unknown> {
    const { requirementId, action, newValue, newSeverity, reason, approvedBy } =
      data;

    const config = await prisma.projectComplianceConfig.findUnique({
      where: { projectId },
      select: {
        id: true,
        packs: {
          include: {
            requirements: { select: { id: true } },
          },
        },
      },
    });
    if (!config) {
      throw notFound(
        `No compliance config found for project: ${projectId}`,
        "CONFIG_NOT_FOUND",
      );
    }

    const requirement = await prisma.requirement.findUnique({
      where: { id: requirementId },
      select: { id: true, code: true },
    });
    if (!requirement) {
      throw notFound(
        `Requirement not found: ${requirementId}`,
        "REQUIREMENT_NOT_FOUND",
      );
    }

    const isInAssignedPacks = config.packs.some((pack) =>
      pack.requirements.some((r) => r.id === requirementId),
    );
    if (!isInAssignedPacks) {
      throw badRequest(
        `Requirement ${requirement.code} does not belong to any pack assigned to this project`,
        "REQUIREMENT_NOT_IN_ASSIGNED_PACKS",
      );
    }

    if (action === OVERRIDE_ACTIONS.MODIFY_VALUE && !newValue) {
      throw badRequest(
        "newValue is required when action is MODIFY_VALUE",
        "MISSING_NEW_VALUE",
      );
    }

    if (action === OVERRIDE_ACTIONS.CHANGE_SEVERITY && !newSeverity) {
      throw badRequest(
        "newSeverity is required when action is CHANGE_SEVERITY",
        "MISSING_NEW_SEVERITY",
      );
    }

    const existing = await prisma.requirementOverride.findUnique({
      where: { configId_requirementId: { configId: config.id, requirementId } },
      select: { id: true },
    });
    if (existing) {
      throw conflict(
        `Override already exists for requirement ${requirement.code} in this config`,
        "OVERRIDE_ALREADY_EXISTS",
      );
    }

    const override = await prisma.requirementOverride.create({
      data: {
        configId: config.id,
        requirementId,
        action,
        newValue: newValue ?? null,
        newSeverity: newSeverity ?? null,
        reason,
        approvedBy,
      },
      include: {
        requirement: { select: { id: true, code: true, description: true } },
      },
    });

    await cacheService.del(configCacheKey(projectId));

    await auditService.log({
      userId,
      action: "ADD_OVERRIDE",
      entity: "RequirementOverride",
      entityId: override.id,
      details: {
        projectId,
        requirementId,
        requirementCode: requirement.code,
        action,
      },
    });

    logger.info("[ProjectConfig] Added override", {
      overrideId: override.id,
      projectId,
      requirementId,
      action,
    });

    return override;
  }

  async removeOverride(overrideId: string, userId?: string): Promise<void> {
    const override = await prisma.requirementOverride.findUnique({
      where: { id: overrideId },
      select: {
        id: true,
        configId: true,
        requirementId: true,
        config: { select: { projectId: true } },
      },
    });
    if (!override) {
      throw notFound(
        `RequirementOverride not found: ${overrideId}`,
        "OVERRIDE_NOT_FOUND",
      );
    }

    await prisma.requirementOverride.delete({ where: { id: overrideId } });

    await cacheService.del(configCacheKey(override.config.projectId));

    await auditService.log({
      userId,
      action: "REMOVE_OVERRIDE",
      entity: "RequirementOverride",
      entityId: overrideId,
      details: {
        configId: override.configId,
        requirementId: override.requirementId,
      },
    });

    logger.info("[ProjectConfig] Removed override", {
      overrideId,
      configId: override.configId,
    });
  }

  async getResolved(projectId: string): Promise<ResolvedRequirement[]> {
    const config = await prisma.projectComplianceConfig.findUnique({
      where: { projectId },
      select: {
        packs: {
          select: { id: true },
        },
        overrides: {
          select: {
            requirementId: true,
            action: true,
            newValue: true,
            newSeverity: true,
            reason: true,
          },
        },
      },
    });

    if (!config) {
      return [];
    }

    const packIds = config.packs.map((p) => p.id);
    if (packIds.length === 0) {
      return [];
    }

    const requirements = await prisma.requirement.findMany({
      where: { packId: { in: packIds } },
      include: {
        conditions: { orderBy: { sortOrder: "asc" } },
        applicability: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const overrideMap = new Map(
      config.overrides.map((o) => [o.requirementId, o]),
    );

    const resolved: ResolvedRequirement[] = [];

    for (const req of requirements) {
      const override = overrideMap.get(req.id);

      if (override?.action === OVERRIDE_ACTIONS.SKIP) {
        continue;
      }

      const resolved_req: ResolvedRequirement = {
        id: req.id,
        code: req.code,
        packId: req.packId,
        description: req.description,
        legalReference: req.legalReference,
        discipline: req.discipline,
        severity: req.severity,
        tags: req.tags,
        notes: req.notes,
        status: req.status,
        conditions: req.conditions,
        applicability: req.applicability,
        overridden: override !== undefined,
      };

      if (override) {
        resolved_req.overrideReason = override.reason;
        resolved_req.overrideAction = override.action;

        if (
          override.action === OVERRIDE_ACTIONS.CHANGE_SEVERITY &&
          override.newSeverity
        ) {
          resolved_req.severity = override.newSeverity;
          resolved_req.overrideNewSeverity = override.newSeverity;
        }

        if (
          override.action === OVERRIDE_ACTIONS.MODIFY_VALUE &&
          override.newValue
        ) {
          resolved_req.overrideNewValue = override.newValue;
        }
      }

      resolved.push(resolved_req);
    }

    return resolved;
  }
}

export const projectComplianceConfigService =
  new ProjectComplianceConfigService();
