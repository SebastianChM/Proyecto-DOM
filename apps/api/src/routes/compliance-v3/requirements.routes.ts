import { Router, Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { requirementService } from "../../services/compliance-v3/requirement.service";
import {
  createRequirementSchema,
  updateRequirementSchema,
  bulkCreateRequirementsSchema,
  verifyRequirementSchema,
  listRequirementsFilterSchema,
} from "./schemas";

const router = Router();

function getUserId(req: Request): string | undefined {
  return req.session?.user?.id;
}

router.get(
  "/packs/:packId/requirements",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = listRequirementsFilterSchema.safeParse(req.query);
    if (!validation.success) {
      throw badRequest("Invalid query parameters", "VALIDATION_ERROR");
    }

    const packId = req.params.packId as string;
    const result = await requirementService.list(packId, validation.data);
    logger.info("[RequirementRoutes] Listed requirements", {
      packId,
      page: validation.data.page,
      total: result.pagination.total,
    });
    res.json(result);
  }),
);

router.get(
  "/requirements/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const requirement = await requirementService.getById(id);
    res.json(requirement);
  }),
);

router.post(
  "/packs/:packId/requirements",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = createRequirementSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const packId = req.params.packId as string;
    const requirement = await requirementService.create(
      packId,
      validation.data,
      getUserId(req),
    );
    res.status(201).json(requirement);
  }),
);

router.patch(
  "/requirements/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = updateRequirementSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const id = req.params.id as string;
    const requirement = await requirementService.update(
      id,
      validation.data,
      getUserId(req),
    );
    res.json(requirement);
  }),
);

router.post(
  "/requirements/:id/verify",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = verifyRequirementSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const id = req.params.id as string;
    const requirement = await requirementService.verify(id, validation.data);
    res.json(requirement);
  }),
);

router.delete(
  "/requirements/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await requirementService.delete(id, getUserId(req));
    res.status(204).send();
  }),
);

router.post(
  "/packs/:packId/requirements/bulk",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = bulkCreateRequirementsSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const packId = req.params.packId as string;
    const results = await requirementService.bulkCreate(
      packId,
      validation.data,
      getUserId(req),
    );
    res.status(201).json(results);
  }),
);

export default router;
