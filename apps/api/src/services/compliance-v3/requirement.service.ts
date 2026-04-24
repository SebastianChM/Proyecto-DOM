import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "../../lib/logger";
import { auditService } from "../audit.service";
import { notFound, badRequest } from "../../lib/errors";
import type {
  CreateRequirementInput,
  UpdateRequirementInput,
  BulkCreateRequirementsInput,
  VerifyRequirementInput,
  ListRequirementsFilter,
  PaginatedResponse,
} from "../../routes/compliance-v3/schemas";

export interface IRequirementService {
  list(packId: string, filters: ListRequirementsFilter): Promise<PaginatedResponse<unknown>>;
  getById(id: string): Promise<unknown>;
  create(packId: string, data: CreateRequirementInput, userId?: string): Promise<unknown>;
  update(id: string, data: UpdateRequirementInput, userId?: string): Promise<unknown>;
  verify(id: string, input: VerifyRequirementInput): Promise<unknown>;
  retire(id: string, userId?: string): Promise<unknown>;
  bulkCreate(packId: string, input: BulkCreateRequirementsInput, userId?: string): Promise<unknown[]>;
  delete(id: string, userId?: string): Promise<void>;
}

export class RequirementService implements IRequirementService {
  /**
   * List requirements for a pack with pagination and filters.
   */
  async list(
    packId: string,
    filters: ListRequirementsFilter,
  ): Promise<PaginatedResponse<unknown>> {
    const { page, limit, sortBy, sortOrder, discipline, status, severity } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { packId };
    if (discipline) where.discipline = discipline;
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const orderBy = sortBy
      ? { [sortBy]: sortOrder as Prisma.SortOrder }
      : { createdAt: "desc" as Prisma.SortOrder };

    const [data, total] = await Promise.all([
      prisma.requirement.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { conditions: true } },
        },
      }),
      prisma.requirement.count({ where }),
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

  /**
   * Get a requirement by ID with conditions and applicability.
   */
  async getById(id: string) {
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        conditions: { orderBy: { sortOrder: "asc" } },
        applicability: true,
      },
    });

    if (!requirement) {
      throw notFound(`Requirement not found: ${id}`, "REQUIREMENT_NOT_FOUND");
    }

    return requirement;
  }

  /**
   * Create a requirement in a pack. Always created as DRAFT.
   * Requires at least 1 condition and a legalReference.
   */
  async create(packId: string, data: CreateRequirementInput, userId?: string) {
    // Verify pack exists
    const pack = await prisma.regulationPack.findUnique({
      where: { id: packId },
    });
    if (!pack) {
      throw notFound(`RegulationPack not found: ${packId}`, "PACK_NOT_FOUND");
    }

    const requirement = await prisma.requirement.create({
      data: {
        code: data.code,
        packId,
        description: data.description,
        legalReference: data.legalReference,
        discipline: data.discipline,
        severity: data.severity,
        tags: data.tags,
        notes: data.notes,
        status: "DRAFT",
        conditions: {
          create: data.conditions.map((c) => ({
            propertyRef: c.propertyRef,
            operator: c.operator,
            value: c.value,
            unit: c.unit,
            tolerance: c.tolerance,
            logicGroup: c.logicGroup,
            sortOrder: c.sortOrder,
          })),
        },
        applicability: data.applicability
          ? {
              create: {
                targetCategories: data.applicability.targetCategories,
                excludeCategories: data.applicability.excludeCategories,
                propertyFilters: (data.applicability.propertyFilters as Prisma.InputJsonValue) ?? undefined,
                scope: data.applicability.scope,
              },
            }
          : undefined,
      },
      include: {
        conditions: { orderBy: { sortOrder: "asc" } },
        applicability: true,
      },
    });

    await auditService.log({
      userId,
      action: "CREATE",
      entity: "Requirement",
      entityId: requirement.id,
      details: { code: requirement.code, packId },
    });

    logger.info("[Requirement] Created", {
      id: requirement.id,
      code: requirement.code,
      packId,
    });
    return requirement;
  }

  /**
   * Update a requirement. Only allowed in DRAFT or VERIFIED status.
   * If VERIFIED, editing resets it back to DRAFT.
   */
  async update(id: string, data: UpdateRequirementInput, userId?: string) {
    const requirement = await this.getById(id);

    if (requirement.status !== "DRAFT" && requirement.status !== "VERIFIED") {
      throw badRequest(
        `Cannot update requirement in status "${requirement.status}". Only DRAFT or VERIFIED requirements can be updated.`,
        "REQUIREMENT_NOT_EDITABLE",
      );
    }

    // If VERIFIED, reset to DRAFT
    const statusReset =
      requirement.status === "VERIFIED"
        ? { status: "DRAFT", verifiedBy: null, verifiedAt: null }
        : {};

    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing conditions/applicability if being replaced
      if (data.conditions) {
        await tx.requirementCondition.deleteMany({
          where: { requirementId: id },
        });
      }
      if (data.applicability) {
        await tx.applicabilityRule.deleteMany({
          where: { requirementId: id },
        });
      }

      return tx.requirement.update({
        where: { id },
        data: {
          ...statusReset,
          description: data.description,
          legalReference: data.legalReference,
          discipline: data.discipline,
          severity: data.severity,
          tags: data.tags,
          notes: data.notes,
          conditions: data.conditions
            ? {
                create: data.conditions.map((c) => ({
                  propertyRef: c.propertyRef,
                  operator: c.operator,
                  value: c.value,
                  unit: c.unit,
                  tolerance: c.tolerance,
                  logicGroup: c.logicGroup,
                  sortOrder: c.sortOrder,
                })),
              }
            : undefined,
          applicability: data.applicability
            ? {
                create: {
                  targetCategories: data.applicability.targetCategories,
                  excludeCategories: data.applicability.excludeCategories,
                  propertyFilters: (data.applicability.propertyFilters as Prisma.InputJsonValue) ?? undefined,
                  scope: data.applicability.scope,
                },
              }
            : undefined,
        },
        include: {
          conditions: { orderBy: { sortOrder: "asc" } },
          applicability: true,
        },
      });
    });

    await auditService.log({
      userId,
      action: "UPDATE",
      entity: "Requirement",
      entityId: id,
      details: {
        changes: Object.keys(data),
        statusReset: Object.keys(statusReset).length > 0,
      },
    });

    logger.info("[Requirement] Updated", { id, changes: Object.keys(data) });
    return updated;
  }

  /**
   * Verify a requirement: DRAFT -> VERIFIED.
   * Verifier must be different from the creator (enforced at route level via userId).
   */
  async verify(id: string, input: VerifyRequirementInput) {
    const requirement = await this.getById(id);

    if (requirement.status !== "DRAFT") {
      throw badRequest(
        `Cannot verify requirement in status "${requirement.status}". Only DRAFT requirements can be verified.`,
        "REQUIREMENT_NOT_VERIFIABLE",
      );
    }

    const updated = await prisma.requirement.update({
      where: { id },
      data: {
        status: "VERIFIED",
        verifiedBy: input.userId,
        verifiedAt: new Date(),
      },
      include: {
        conditions: { orderBy: { sortOrder: "asc" } },
        applicability: true,
      },
    });

    await auditService.log({
      userId: input.userId,
      action: "VERIFY",
      entity: "Requirement",
      entityId: id,
      details: { code: requirement.code },
    });

    logger.info("[Requirement] Verified", {
      id,
      code: requirement.code,
      verifiedBy: input.userId,
    });
    return updated;
  }

  /**
   * Retire a requirement: ACTIVE or VERIFIED -> RETIRED (soft delete).
   */
  async retire(id: string, userId?: string) {
    const requirement = await this.getById(id);

    if (requirement.status !== "ACTIVE" && requirement.status !== "VERIFIED") {
      throw badRequest(
        `Cannot retire requirement in status "${requirement.status}". Only ACTIVE or VERIFIED requirements can be retired.`,
        "REQUIREMENT_NOT_RETIRABLE",
      );
    }

    const updated = await prisma.requirement.update({
      where: { id },
      data: { status: "RETIRED" },
      include: {
        conditions: { orderBy: { sortOrder: "asc" } },
        applicability: true,
      },
    });

    await auditService.log({
      userId,
      action: "RETIRE",
      entity: "Requirement",
      entityId: id,
      details: { code: requirement.code },
    });

    logger.info("[Requirement] Retired", { id, code: requirement.code });
    return updated;
  }

  /**
   * Bulk create requirements in a pack. Max 100 per request.
   */
  async bulkCreate(
    packId: string,
    input: BulkCreateRequirementsInput,
    userId?: string,
  ) {
    // Verify pack exists
    const pack = await prisma.regulationPack.findUnique({
      where: { id: packId },
    });
    if (!pack) {
      throw notFound(`RegulationPack not found: ${packId}`, "PACK_NOT_FOUND");
    }

    const results = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const reqData of input.requirements) {
        const requirement = await tx.requirement.create({
          data: {
            code: reqData.code,
            packId,
            description: reqData.description,
            legalReference: reqData.legalReference,
            discipline: reqData.discipline,
            severity: reqData.severity,
            tags: reqData.tags,
            notes: reqData.notes,
            status: "DRAFT",
            conditions: {
              create: reqData.conditions.map((c) => ({
                propertyRef: c.propertyRef,
                operator: c.operator,
                value: c.value,
                unit: c.unit,
                tolerance: c.tolerance,
                logicGroup: c.logicGroup,
                sortOrder: c.sortOrder,
              })),
            },
            applicability: reqData.applicability
              ? {
                  create: {
                    targetCategories: reqData.applicability.targetCategories,
                    excludeCategories: reqData.applicability.excludeCategories,
                    propertyFilters:
                      (reqData.applicability.propertyFilters as Prisma.InputJsonValue) ?? undefined,
                    scope: reqData.applicability.scope,
                  },
                }
              : undefined,
          },
          include: {
            conditions: { orderBy: { sortOrder: "asc" } },
            applicability: true,
          },
        });
        created.push(requirement);
      }
      return created;
    });

    await auditService.log({
      userId,
      action: "BULK_CREATE",
      entity: "Requirement",
      details: {
        packId,
        count: results.length,
        codes: results.map((r) => r.code),
      },
    });

    logger.info("[Requirement] Bulk created", {
      packId,
      count: results.length,
    });
    return results;
  }

  /**
   * Delete a requirement. Only DRAFT requirements can be physically deleted.
   */
  async delete(id: string, userId?: string) {
    const requirement = await this.getById(id);

    if (requirement.status !== "DRAFT") {
      throw badRequest(
        `Cannot delete requirement in status "${requirement.status}". Only DRAFT requirements can be deleted. Use retire for ACTIVE/VERIFIED requirements.`,
        "REQUIREMENT_NOT_DELETABLE",
      );
    }

    await prisma.requirement.delete({ where: { id } });

    await auditService.log({
      userId,
      action: "DELETE",
      entity: "Requirement",
      entityId: id,
      details: { code: requirement.code },
    });

    logger.info("[Requirement] Deleted", { id, code: requirement.code });
  }
}

export const requirementService = new RequirementService();
