import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { Request } from "express";
import { Prisma } from "@prisma/client";

export interface AuditEntry {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

class AuditService {
  async log(entry: AuditEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          details: entry.details ?? undefined,
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Audit logging should never break the main flow
      logger.error("[AUDIT] Failed to write audit log", {
        error: error instanceof Error ? error.message : String(error),
        entry,
      });
    }
  }

  /** Helper to extract user/IP/UA from Express request */
  fromReq(req: Request): Pick<AuditEntry, "userId" | "ip" | "userAgent"> {
    return {
      userId: req.session?.user?.id,
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
      userAgent: req.headers["user-agent"],
    };
  }

  async query(filters: {
    userId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entity) where.entity = filters.entity;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(filters.limit || 50, 200),
        skip: filters.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}

export const auditService = new AuditService();
