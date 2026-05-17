import { Router } from "express";
import { auditService } from "../services/audit.service";
import { asyncHandler } from "../lib/async-handler";
import { requireAdmin } from "../middleware/authorization";

const router = Router();

/**
 * GET /api/audit
 * Query audit logs (admin only)
 */
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId, action, entity, entityId, from, to, limit, offset } =
      req.query as Record<string, string>;

    const result = await auditService.query({
      userId,
      action,
      entity,
      entityId,
      from: from
        ? isNaN(Date.parse(from))
          ? undefined
          : new Date(from)
        : undefined,
      to: to ? (isNaN(Date.parse(to)) ? undefined : new Date(to)) : undefined,
      limit: Math.min(500, Math.max(1, parseInt(limit, 10) || 50)),
      offset: Math.max(0, parseInt(offset, 10) || 0),
    });

    res.json(result);
  }),
);

export default router;
