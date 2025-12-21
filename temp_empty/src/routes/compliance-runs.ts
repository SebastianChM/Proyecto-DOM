/**
 * Compliance Runs API
 *
 * Endpoints for executing and retrieving compliance runs
 * Part of Compliance Engine V2
 */

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  complianceRunnerService,
  BimElement,
} from "../services/compliance-runner.service";
import { BimQueryService } from "../services/bim-query.service";

const router = Router();
const bimQueryService = new BimQueryService();

/**
 * POST /api/compliance-v2/runs
 * Execute a new compliance run
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { rulesetId, projectId, modelUrn, elements } = req.body;

    if (!rulesetId) {
      return res.status(400).json({ error: "rulesetId is required" });
    }

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ error: "elements array is required" });
    }

    console.log(
      `[ComplianceAPI] Starting run: ruleset=${rulesetId}, elements=${elements.length}`,
    );

    const result = await complianceRunnerService.run(
      elements as BimElement[],
      rulesetId,
      projectId,
      modelUrn,
    );

    res.status(201).json(result);
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Run error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/compliance-v2/runs/model
 * Execute compliance run on a REAL model from APS
 * This extracts properties from the model and validates against rules
 */
router.post("/model", async (req: Request, res: Response) => {
  try {
    const { rulesetId, projectId, modelUrn, modelName } = req.body;

    if (!rulesetId) {
      return res.status(400).json({ error: "rulesetId is required" });
    }

    if (!modelUrn) {
      return res.status(400).json({ error: "modelUrn is required" });
    }

    console.log(`[ComplianceAPI] Running compliance on real model`);
    console.log(`  URN: ${modelUrn}`);
    console.log(`  Ruleset: ${rulesetId}`);

    // 1. Extract properties from the real model using BimQueryService
    console.log(`[ComplianceAPI] Extracting properties from model...`);
    const bimProperties = await bimQueryService.queryModel(modelUrn);

    if (!bimProperties || bimProperties.length === 0) {
      return res.status(400).json({
        error:
          "No properties could be extracted from the model. Make sure the model is processed.",
      });
    }

    console.log(
      `[ComplianceAPI] Extracted ${bimProperties.length} elements from model`,
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

    console.log(
      `[ComplianceAPI] Model compliance complete. Score: ${result.complianceScore}%, Issues: ${result.issues?.length || 0}`,
    );

    res.status(201).json(result);
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Model run error:", error);

    // Provide more helpful error messages
    if (
      error instanceof Error &&
      error.message?.includes("No Property Database")
    ) {
      return res.status(400).json({
        error:
          "Model properties not yet available. Please wait for model processing to complete.",
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/compliance-v2/runs/demo
 * Execute a compliance run with demo/test data
 */
router.post("/demo", async (req: Request, res: Response) => {
  try {
    const { rulesetId, projectId } = req.body;

    if (!rulesetId) {
      return res.status(400).json({ error: "rulesetId is required" });
    }

    // Generate demo elements based on ruleset discipline
    const ruleset = await prisma.ruleset.findUnique({
      where: { id: rulesetId },
      include: { rules: { where: { isActive: true } } },
    });

    if (!ruleset) {
      return res.status(404).json({ error: "Ruleset not found" });
    }

    // Create demo elements matching the rules
    const demoElements: BimElement[] = generateDemoElements(ruleset);

    console.log(`[ComplianceAPI] Demo run: ${demoElements.length} elements`);

    const result = await complianceRunnerService.run(
      demoElements,
      rulesetId,
      projectId || "demo-project",
      "demo-model",
    );

    res.status(201).json(result);
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Demo run error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance-v2/runs
 * List compliance runs for a project
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { projectId, limit = "10" } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const runs = await complianceRunnerService.getRuns(
      projectId as string,
      parseInt(limit as string),
    );

    res.json(runs);
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance-v2/runs/models
 * Get available models from a project for compliance checking
 */
router.get("/models", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    // Get project files that are models (RVT, IFC, NWC, DWG)
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
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Models error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance-v2/runs/projects
 * Get available projects for compliance checking
 */
router.get("/projects", async (req: Request, res: Response) => {
  try {
    // Get all projects (not just those with ready models, to show all options)
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
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Projects error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance-v2/runs/:id
 * Get a specific compliance run
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
      return res.status(404).json({ error: "Run not found" });
    }

    res.json(run);
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance-v2/runs/:id/issues
 * Get issues for a specific run
 */
router.get("/:id/issues", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { severity, category } = req.query;

    const whereClause: {
      runId: string;
      severity?: string;
      elementCategory?: { contains: string };
    } = { runId: id };
    if (severity && typeof severity === "string")
      whereClause.severity = severity;
    if (category && typeof category === "string")
      whereClause.elementCategory = { contains: category };

    const issues = await prisma.complianceIssue.findMany({
      where: whereClause,
      orderBy: [{ severity: "asc" }, { elementCategory: "asc" }],
    });

    res.json(issues);
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/compliance-v2/runs/issues/:issueId/status
 * Update issue status (e.g., mark as resolved)
 */
router.put("/issues/:issueId/status", async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params;
    const { status, resolutionNote } = req.body;

    if (!["OPEN", "RESOLVED", "IGNORED", "FALSE_POSITIVE"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await prisma.complianceIssue.update({
      where: { id: issueId },
      data: { status, resolutionNote },
    });

    res.json(updated);
  } catch (error: unknown) {
    console.error("[ComplianceAPI] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

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
