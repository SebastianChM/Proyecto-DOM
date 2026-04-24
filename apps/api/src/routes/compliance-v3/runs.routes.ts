import { Router, Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { complianceRunnerV3Service } from "../../services/compliance-v3/compliance-runner-v3.service";
import {
  projectIdParamSchema,
  runIdParamSchema,
  evaluateSchema,
  listRunsQuerySchema,
  runIssuesQuerySchema,
} from "./schemas";

const router = Router();

function getUserId(req: Request): string | undefined {
  return req.session?.user?.id;
}

// POST /projects/:projectId/compliance/evaluate
router.post(
  "/projects/:projectId/compliance/evaluate",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = projectIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const bodyResult = evaluateSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        bodyResult.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { projectId } = paramResult.data;
    const { modelUrn, discipline, dryRun } = bodyResult.data;

    logger.info("[RunsRoutes] Evaluate request", {
      projectId,
      modelUrn,
      discipline,
      dryRun,
    });

    const result = await complianceRunnerV3Service.evaluate(
      projectId,
      modelUrn,
      { discipline, dryRun },
      getUserId(req),
    );

    res.status(202).json(result);
  }),
);

// GET /compliance/runs/:runId
router.get(
  "/compliance/runs/:runId",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = runIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid runId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const { runId } = paramResult.data;
    const run = await complianceRunnerV3Service.getRunById(runId);

    logger.info("[RunsRoutes] Get run", { runId });

    res.json(run);
  }),
);

// GET /projects/:projectId/compliance/runs
router.get(
  "/projects/:projectId/compliance/runs",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = projectIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const queryResult = listRunsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw badRequest(
        "Invalid query parameters",
        "VALIDATION_ERROR",
        queryResult.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { projectId } = paramResult.data;
    const { page, limit } = queryResult.data;

    logger.info("[RunsRoutes] List runs", { projectId, page, limit });

    const result = await complianceRunnerV3Service.listRunsByProject(
      projectId,
      { page, limit },
    );

    res.json(result);
  }),
);

// GET /compliance/runs/:runId/issues
router.get(
  "/compliance/runs/:runId/issues",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = runIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid runId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const queryResult = runIssuesQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw badRequest(
        "Invalid query parameters",
        "VALIDATION_ERROR",
        queryResult.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { runId } = paramResult.data;
    const { page, limit, severity } = queryResult.data;

    logger.info("[RunsRoutes] Get run issues", {
      runId,
      page,
      limit,
      severity,
    });

    const result = await complianceRunnerV3Service.getRunIssues(
      runId,
      { severity },
      { page, limit },
    );

    res.json(result);
  }),
);

export default router;
