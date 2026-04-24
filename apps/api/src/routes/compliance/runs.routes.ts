/**
 * Compliance Runs API
 *
 * Endpoints for executing and retrieving compliance runs
 * Part of Compliance Engine V2
 */

import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import {
  complianceRunnerService,
  BimElement,
} from "../../services/compliance-runner.service";
import { BimQueryService } from "../../services/bim-query.service";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, notFound } from "../../lib/errors";

const router = Router();
const bimQueryService = new BimQueryService();

/**
 * POST /api/compliance-v2/runs
 * Execute a new compliance run
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { rulesetId, projectId, modelUrn, elements } = req.body;

    if (!rulesetId) {
      throw badRequest("rulesetId is required", "MISSING_FIELDS");
    }

    if (!projectId) {
      throw badRequest("projectId is required", "MISSING_FIELDS");
    }

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      throw badRequest("elements array is required", "MISSING_FIELDS");
    }

    logger.info(
      `[COMPLIANCE_RUNS] Starting run: ruleset=${rulesetId}, elements=${elements.length}`,
      logger.fromReq(req),
    );

    const result = await complianceRunnerService.run(
      elements as BimElement[],
      rulesetId,
      projectId,
      modelUrn,
    );

    res.status(201).json(result);
  }),
);

/**
 * POST /api/compliance-v2/runs/model
 * Execute compliance run on a REAL model from APS
 * This extracts properties from the model and validates against rules
 */
router.post(
  "/model",
  asyncHandler(async (req: Request, res: Response) => {
    const { rulesetId, projectId, modelUrn, modelName } = req.body;

    if (!rulesetId) {
      throw badRequest("rulesetId is required", "MISSING_FIELDS");
    }

    if (!modelUrn) {
      throw badRequest("modelUrn is required", "MISSING_FIELDS");
    }

    logger.info(`[COMPLIANCE_RUNS] Running compliance on real model`, {
      ...logger.fromReq(req),
      urn: modelUrn,
      rulesetId,
    });

    // 1. Extract properties from the real model using BimQueryService
    logger.info(`[COMPLIANCE_RUNS] Extracting properties from model...`);
    const bimProperties = await bimQueryService.queryModel(modelUrn);

    if (!bimProperties || bimProperties.length === 0) {
      throw badRequest(
        "No properties could be extracted from the model. Make sure the model is processed.",
        "MODEL_NO_PROPERTIES",
      );
    }

    logger.info(
      `[COMPLIANCE_RUNS] Extracted ${bimProperties.length} elements from model`,
    );

    // 2. Convert BimProperty[] to BimElement[] for the compliance runner
    const elements: BimElement[] = bimProperties.map((prop) => ({
      id: prop.elementId.toString(),
      name: prop.name,
      category: prop.category,
      properties: prop.properties,
    }));

    // 3. Run compliance evaluation
    const result = await complianceRunnerService.run(
      elements,
      rulesetId,
      projectId || "default-project",
      modelUrn,
      modelName,
    );

    logger.info(
      `[COMPLIANCE_RUNS] Model compliance complete. Score: ${result.complianceScore}%, Issues: ${result.issues?.length || 0}`,
      logger.fromReq(req),
    );

    res.status(201).json(result);
  }),
);

/**
 * POST /api/compliance-v2/runs/demo
 * Execute a compliance run with demo/test data
 */
router.post(
  "/demo",
  asyncHandler(async (req: Request, res: Response) => {
    const { rulesetId, projectId } = req.body;

    if (!rulesetId) {
      throw badRequest("rulesetId is required", "MISSING_FIELDS");
    }

    // Generate demo elements based on ruleset discipline
    const ruleset = await prisma.ruleset.findUnique({
      where: { id: rulesetId },
      include: { rules: { where: { isActive: true } } },
    });

    if (!ruleset) {
      throw notFound("Ruleset not found", "RULESET_NOT_FOUND");
    }

    // Create demo elements matching the rules
    const demoElements: BimElement[] = generateDemoElements(ruleset);

    logger.info(
      `[COMPLIANCE_RUNS] Demo run: ${demoElements.length} elements`,
      logger.fromReq(req),
    );

    const result = await complianceRunnerService.run(
      demoElements,
      rulesetId,
      projectId || "demo-project",
      "demo-model",
    );

    res.status(201).json(result);
  }),
);

/**
 * GET /api/compliance-v2/runs
 * List compliance runs for a project
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, limit = "10" } = req.query;

    if (!projectId) {
      throw badRequest("projectId is required", "MISSING_FIELDS");
    }

    const runs = await complianceRunnerService.getRuns(
      projectId as string,
      parseInt(limit as string),
    );

    res.json(runs);
  }),
);

/**
 * GET /api/compliance-v2/runs/models
 * Get available models from a project for compliance checking
 */
router.get(
  "/models",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.query;

    if (!projectId) {
      throw badRequest("projectId is required", "MISSING_FIELDS");
    }

    const models = await prisma.file.findMany({
      where: {
        projectId: projectId as string,
        type: {
          in: ["RVT", "IFC", "NWC", "DWG"],
        },
        status: "READY",
        apsUrn: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        apsUrn: true,
        size: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.json(models);
  }),
);

/**
 * GET /api/compliance-v2/runs/projects
 * Get available projects for compliance checking
 */
router.get(
  "/projects",
  asyncHandler(async (req: Request, res: Response) => {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            files: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.json(projects);
  }),
);

/**
 * GET /api/compliance-v2/runs/:id
 * Get a specific compliance run
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const run = await prisma.complianceRun.findUnique({
      where: { id },
      include: {
        ruleset: true,
        issues: {
          orderBy: [{ severity: "asc" }, { elementCategory: "asc" }],
        },
      },
    });

    if (!run) {
      throw notFound("Run not found", "RUN_NOT_FOUND");
    }

    res.json(run);
  }),
);

/**
 * GET /api/compliance-v2/runs/:id/issues
 * Get issues for a specific run with server-side pagination, search, and filters
 */
router.get(
  "/:id/issues",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { severity, category, status, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 50));

    const whereClause: Record<string, unknown> = { runId: id };
    if (severity && typeof severity === "string" && severity !== "all")
      whereClause.severity = severity;
    if (status && typeof status === "string" && status !== "all")
      whereClause.status = status;
    if (category && typeof category === "string")
      whereClause.elementCategory = { contains: category };
    if (search && typeof search === "string") {
      const term = search.trim();
      if (term) {
        whereClause.OR = [
          { ruleName: { contains: term, mode: "insensitive" } },
          { elementName: { contains: term, mode: "insensitive" } },
          { elementCategory: { contains: term, mode: "insensitive" } },
          { propertyName: { contains: term, mode: "insensitive" } },
        ];
      }
    }

    const [total, issues, severityCounts] = await Promise.all([
      prisma.complianceIssue.count({ where: whereClause }),
      prisma.complianceIssue.findMany({
        where: whereClause,
        orderBy: [{ severity: "asc" }, { elementCategory: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // Unfiltered severity counts for summary pills
      prisma.complianceIssue.groupBy({
        by: ["severity"],
        where: { runId: id },
        _count: true,
      }),
    ]);

    const counts = severityCounts.reduce((acc, s) => {
      acc[s.severity] = s._count;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      counts,
      data: issues,
    });
  }),
);

/**
 * PUT /api/compliance-v2/runs/issues/:issueId/status
 * Update issue status (e.g., mark as resolved)
 */
router.put(
  "/issues/:issueId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const issueId = req.params.issueId as string;
    const { status, resolutionNote } = req.body;

    if (!["OPEN", "RESOLVED", "IGNORED", "FALSE_POSITIVE"].includes(status)) {
      throw badRequest("Invalid status", "INVALID_STATUS");
    }

    const updated = await prisma.complianceIssue.update({
      where: { id: issueId },
      data: { status, resolutionNote },
    });

    res.json(updated);
  }),
);

/**
 * Generate demo elements for testing
 */
function generateDemoElements(ruleset: {
  rules: Array<{
    targetCategory?: string;
    propertyName: string;
    expectedValue: string;
  }>;
}): BimElement[] {
  const elements: BimElement[] = [];
  const categories = new Set<string>();

  // Get unique categories from rules
  for (const rule of ruleset.rules) {
    if (rule.targetCategory) {
      categories.add(rule.targetCategory);
    }
  }

  // Generate elements for each category
  let elementId = 1;
  for (const category of categories) {
    // Generate 5 elements per category, some passing, some failing
    for (let i = 0; i < 5; i++) {
      const properties: Record<string, string | number> = {};

      // Add relevant properties based on rules
      for (const rule of ruleset.rules) {
        if (rule.targetCategory === category) {
          const expectedNum = parseFloat(rule.expectedValue);
          if (!isNaN(expectedNum)) {
            // 60% pass, 40% fail
            if (Math.random() > 0.4) {
              // Passing value
              properties[rule.propertyName] =
                expectedNum + (Math.random() - 0.5) * 10;
            } else {
              // Failing value (significantly different)
              properties[rule.propertyName] =
                expectedNum * (0.3 + Math.random() * 0.4);
            }
          } else {
            properties[rule.propertyName] =
              Math.random() > 0.4 ? rule.expectedValue : "Invalid";
          }
        }
      }

      elements.push({
        id: `demo-${elementId++}`,
        name: `${category} ${i + 1}`,
        category,
        properties,
      });
    }
  }

  return elements;
}

export default router;
