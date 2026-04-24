import { Router, Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { regulationPackService } from "../../services/compliance-v3/regulation-pack.service";
import {
  createPackSchema,
  updatePackSchema,
  listPacksFilterSchema,
} from "./schemas";

const router = Router();

function getUserId(req: Request): string | undefined {
  return req.session?.user?.id;
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = listPacksFilterSchema.safeParse(req.query);
    if (!validation.success) {
      throw badRequest("Invalid query parameters", "VALIDATION_ERROR");
    }

    const result = await regulationPackService.list(validation.data);
    logger.info("[PackRoutes] Listed packs", {
      page: validation.data.page,
      total: result.pagination.total,
    });
    res.json(result);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const pack = await regulationPackService.getById(id);
    res.json(pack);
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = createPackSchema.safeParse(req.body);
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

    const pack = await regulationPackService.create(
      validation.data,
      getUserId(req),
    );
    res.status(201).json(pack);
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const validation = updatePackSchema.safeParse(req.body);
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
    const pack = await regulationPackService.update(
      id,
      validation.data,
      getUserId(req),
    );
    res.json(pack);
  }),
);

router.post(
  "/:id/publish",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const pack = await regulationPackService.publish(id, getUserId(req));
    res.json(pack);
  }),
);

router.post(
  "/:id/deprecate",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const pack = await regulationPackService.deprecate(id, getUserId(req));
    res.json(pack);
  }),
);

export default router;
