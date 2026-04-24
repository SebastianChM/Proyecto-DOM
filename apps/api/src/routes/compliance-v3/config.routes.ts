import { Router, Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { projectComplianceConfigService } from "../../services/compliance-v3/project-config.service";
import {
  projectIdParamSchema,
  upsertConfigSchema,
  addOverrideSchema,
  overrideIdParamSchema,
} from "./schemas";

const router = Router();

function getUserId(req: Request): string | undefined {
  return req.session?.user?.id;
}

router.get(
  "/projects/:projectId/compliance-config",
  asyncHandler(async (req: Request, res: Response) => {
    const paramValidation = projectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramValidation.error.issues,
      );
    }

    const { projectId } = paramValidation.data;
    const config = await projectComplianceConfigService.getConfig(projectId);

    logger.info("[ConfigRoutes] Get config", {
      projectId,
      found: config !== null,
    });
    res.json(config);
  }),
);

router.put(
  "/projects/:projectId/compliance-config",
  asyncHandler(async (req: Request, res: Response) => {
    const paramValidation = projectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramValidation.error.issues,
      );
    }

    const bodyValidation = upsertConfigSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        bodyValidation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { projectId } = paramValidation.data;
    const config = await projectComplianceConfigService.upsertConfig(
      projectId,
      bodyValidation.data,
      getUserId(req),
    );

    logger.info("[ConfigRoutes] Upserted config", { projectId });
    res.json(config);
  }),
);

router.post(
  "/projects/:projectId/compliance-config/overrides",
  asyncHandler(async (req: Request, res: Response) => {
    const paramValidation = projectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramValidation.error.issues,
      );
    }

    const bodyValidation = addOverrideSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        bodyValidation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { projectId } = paramValidation.data;
    const override = await projectComplianceConfigService.addOverride(
      projectId,
      bodyValidation.data,
      getUserId(req),
    );

    logger.info("[ConfigRoutes] Added override", { projectId });
    res.status(201).json(override);
  }),
);

router.delete(
  "/projects/:projectId/compliance-config/overrides/:overrideId",
  asyncHandler(async (req: Request, res: Response) => {
    const paramValidation = projectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramValidation.error.issues,
      );
    }

    const overrideParamValidation = overrideIdParamSchema.safeParse(req.params);
    if (!overrideParamValidation.success) {
      throw badRequest(
        "Invalid overrideId",
        "VALIDATION_ERROR",
        overrideParamValidation.error.issues,
      );
    }

    const { overrideId } = overrideParamValidation.data;
    await projectComplianceConfigService.removeOverride(
      overrideId,
      getUserId(req),
    );

    logger.info("[ConfigRoutes] Removed override", { overrideId });
    res.status(204).send();
  }),
);

router.get(
  "/projects/:projectId/compliance-config/resolved",
  asyncHandler(async (req: Request, res: Response) => {
    const paramValidation = projectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramValidation.error.issues,
      );
    }

    const { projectId } = paramValidation.data;
    const resolved =
      await projectComplianceConfigService.getResolved(projectId);

    logger.info("[ConfigRoutes] Get resolved requirements", {
      projectId,
      count: resolved.length,
    });
    res.json(resolved);
  }),
);

export default router;
