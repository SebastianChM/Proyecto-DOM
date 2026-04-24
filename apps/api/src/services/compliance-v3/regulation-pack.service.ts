import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "../../lib/logger";
import { auditService } from "../audit.service";
import { notFound, badRequest, conflict } from "../../lib/errors";
import type {
  CreatePackInput,
  UpdatePackInput,
  ListPacksFilter,
  PaginatedResponse,
} from "../../routes/compliance-v3/schemas";

export interface IRegulationPackService {
  list(filters: ListPacksFilter): Promise<PaginatedResponse<unknown>>;
  getById(id: string): Promise<unknown>;
  create(data: CreatePackInput, userId?: string): Promise<unknown>;
  update(id: string, data: UpdatePackInput, userId?: string): Promise<unknown>;
  publish(id: string, userId?: string): Promise<unknown>;
  deprecate(id: string, userId?: string): Promise<unknown>;
}

export class RegulationPackService implements IRegulationPackService {
  /**
   * List packs with pagination and optional filters.
   */
  async list(filters: ListPacksFilter): Promise<PaginatedResponse<unknown>> {
    const { page, limit, sortBy, sortOrder, country, status, scope } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (country) where.country = country;
    if (status) where.status = status;
    if (scope) where.scope = { has: scope };

    const orderBy = sortBy
      ? { [sortBy]: sortOrder as Prisma.SortOrder }
      : { createdAt: "desc" as Prisma.SortOrder };

    const [data, total] = await Promise.all([
      prisma.regulationPack.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { requirements: true } },
        },
      }),
      prisma.regulationPack.count({ where }),
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
   * Get a pack by ID with requirement count.
   */
  async getById(id: string) {
    const pack = await prisma.regulationPack.findUnique({
      where: { id },
      include: {
        _count: { select: { requirements: true } },
        documents: true,
      },
    });

    if (!pack) {
      throw notFound(`RegulationPack not found: ${id}`, "PACK_NOT_FOUND");
    }

    return pack;
  }

  /**
   * Create a new pack with status DRAFT.
   */
  async create(data: CreatePackInput, userId?: string) {
    // Check for duplicate code
    const existing = await prisma.regulationPack.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw conflict(`Pack code already exists: ${data.code}`, "PACK_CODE_DUPLICATE");
    }

    const pack = await prisma.regulationPack.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        country: data.country,
        version: data.version,
        scope: data.scope,
        status: "DRAFT",
        organizationId: data.organizationId,
      },
    });

    await auditService.log({
      userId,
      action: "CREATE",
      entity: "RegulationPack",
      entityId: pack.id,
      details: { code: pack.code, name: pack.name },
    });

    logger.info("[RegulationPack] Created", { id: pack.id, code: pack.code });
    return pack;
  }

  /**
   * Update a pack. Only allowed for DRAFT packs.
   */
  async update(id: string, data: UpdatePackInput, userId?: string) {
    const pack = await this.getById(id);

    if (pack.status !== "DRAFT") {
      throw badRequest(
        `Cannot update pack in status "${pack.status}". Only DRAFT packs can be updated.`,
        "PACK_NOT_EDITABLE",
      );
    }

    const updated = await prisma.regulationPack.update({
      where: { id },
      data,
    });

    await auditService.log({
      userId,
      action: "UPDATE",
      entity: "RegulationPack",
      entityId: id,
      details: { changes: data },
    });

    logger.info("[RegulationPack] Updated", { id, changes: Object.keys(data) });
    return updated;
  }

  /**
   * Publish a pack: DRAFT -> PUBLISHED.
   */
  async publish(id: string, userId?: string) {
    const pack = await this.getById(id);

    if (pack.status !== "DRAFT") {
      throw badRequest(
        `Cannot publish pack in status "${pack.status}". Only DRAFT packs can be published.`,
        "PACK_NOT_PUBLISHABLE",
      );
    }

    const updated = await prisma.regulationPack.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await auditService.log({
      userId,
      action: "PUBLISH",
      entity: "RegulationPack",
      entityId: id,
    });

    logger.info("[RegulationPack] Published", { id, code: pack.code });
    return updated;
  }

  /**
   * Deprecate a pack: PUBLISHED -> DEPRECATED.
   */
  async deprecate(id: string, userId?: string) {
    const pack = await this.getById(id);

    if (pack.status !== "PUBLISHED") {
      throw badRequest(
        `Cannot deprecate pack in status "${pack.status}". Only PUBLISHED packs can be deprecated.`,
        "PACK_NOT_DEPRECATABLE",
      );
    }

    const updated = await prisma.regulationPack.update({
      where: { id },
      data: {
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      },
    });

    await auditService.log({
      userId,
      action: "DEPRECATE",
      entity: "RegulationPack",
      entityId: id,
    });

    logger.info("[RegulationPack] Deprecated", { id, code: pack.code });
    return updated;
  }
}

export const regulationPackService = new RegulationPackService();
