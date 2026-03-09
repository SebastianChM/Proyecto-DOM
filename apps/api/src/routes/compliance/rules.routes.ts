/**
 * Compliance Rules API
 *
 * CRUD operations for validation rules and rulesets
 * Part of Compliance Engine V2 - Professional Rule-Based Validation
 */

import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, notFound } from "../../lib/errors";

const router = Router();

// ============================================================
// RULESETS
// ============================================================

/**
 * GET /api/compliance/rulesets
 * List all rulesets, optionally filtered by discipline or project
 */
router.get("/rulesets", asyncHandler(async (req: Request, res: Response) => {
    const { discipline, projectId, includeDefault } = req.query;

    const where: Prisma.RulesetWhereInput = {};

    if (discipline && typeof discipline === "string") {
      where.discipline = discipline;
    }

    if (projectId && typeof projectId === "string") {
      where.OR = [{ projectId: projectId }, { isDefault: true }];
    } else if (includeDefault === "true") {
      where.isDefault = true;
    }

    const rulesets = await prisma.ruleset.findMany({
      where,
      include: {
        rules: {
          select: {
            id: true,
            name: true,
            targetCategory: true,
            severity: true,
            isActive: true,
          },
        },
        _count: {
          select: { rules: true, runs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(rulesets);
}));

/**
 * GET /api/compliance/rulesets/:id
 * Get a single ruleset with all its rules
 */
router.get("/rulesets/:id", asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const ruleset = await prisma.ruleset.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: { targetCategory: "asc" },
        },
      },
    });

    if (!ruleset) {
      throw notFound("Ruleset not found", "RULESET_NOT_FOUND");
    }

    res.json(ruleset);
}));

/**
 * POST /api/compliance/rulesets
 * Create a new ruleset
 */
router.post("/rulesets", asyncHandler(async (req: Request, res: Response) => {
    const { name, description, discipline, projectId, isDefault } = req.body;

    if (!name || !discipline) {
      throw badRequest("Name and discipline are required", "MISSING_FIELDS");
    }

    const ruleset = await prisma.ruleset.create({
      data: {
        name,
        description,
        discipline,
        projectId,
        isDefault: isDefault || false,
      },
    });

    res.status(201).json(ruleset);
}));

/**
 * PUT /api/compliance/rulesets/:id
 * Update a ruleset
 */
router.put("/rulesets/:id", asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, discipline, isDefault } = req.body;

    const ruleset = await prisma.ruleset.update({
      where: { id },
      data: {
        name,
        description,
        discipline,
        isDefault,
      },
    });

    res.json(ruleset);
}));

/**
 * DELETE /api/compliance/rulesets/:id
 * Delete a ruleset and all its rules
 */
router.delete("/rulesets/:id", asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await prisma.ruleset.delete({
      where: { id },
    });

    res.status(204).send();
}));

// ============================================================
// RULES
// ============================================================

/**
 * GET /api/compliance/rules
 * List all rules, optionally filtered
 */
router.get("/rules", asyncHandler(async (req: Request, res: Response) => {
    const { rulesetId, targetCategory, severity, isActive } = req.query;

    const where: Prisma.RuleWhereInput = {};

    if (rulesetId && typeof rulesetId === "string") where.rulesetId = rulesetId;
    if (targetCategory && typeof targetCategory === "string")
      where.targetCategory = targetCategory;
    if (severity && typeof severity === "string") where.severity = severity;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const rules = await prisma.rule.findMany({
      where,
      include: {
        ruleset: {
          select: { id: true, name: true, discipline: true },
        },
      },
      orderBy: [{ targetCategory: "asc" }, { name: "asc" }],
    });

    res.json(rules);
}));

/**
 * GET /api/compliance/rules/:id
 * Get a single rule
 */
router.get("/rules/:id", asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const rule = await prisma.rule.findUnique({
      where: { id },
      include: {
        ruleset: true,
      },
    });

    if (!rule) {
      throw notFound("Rule not found", "RULE_NOT_FOUND");
    }

    res.json(rule);
}));

/**
 * POST /api/compliance/rules
 * Create a new rule
 */
router.post("/rules", asyncHandler(async (req: Request, res: Response) => {
    const {
      name,
      description,
      targetCategory,
      targetNamePattern,
      propertyName,
      operator,
      expectedValue,
      unit,
      tolerance,
      severity,
      sourceDocument,
      sourcePage,
      rulesetId,
      isActive,
    } = req.body;

    // Validation
    if (
      !name ||
      !targetCategory ||
      !propertyName ||
      !operator ||
      !expectedValue ||
      !rulesetId
    ) {
      throw badRequest(
        "Required fields: name, targetCategory, propertyName, operator, expectedValue, rulesetId",
        "MISSING_FIELDS"
      );
    }

    // Verify ruleset exists
    const ruleset = await prisma.ruleset.findUnique({
      where: { id: rulesetId },
    });
    if (!ruleset) {
      throw notFound("Ruleset not found", "RULESET_NOT_FOUND");
    }

    const rule = await prisma.rule.create({
      data: {
        name,
        description,
        targetCategory,
        targetNamePattern,
        propertyName,
        operator,
        expectedValue,
        unit,
        tolerance: tolerance ? parseFloat(tolerance) : null,
        severity: severity || "WARNING",
        sourceDocument,
        sourcePage: sourcePage ? parseInt(sourcePage) : null,
        rulesetId,
        isActive: isActive !== false,
      },
    });

    res.status(201).json(rule);
}));

/**
 * PUT /api/compliance/rules/:id
 * Update a rule
 */
router.put("/rules/:id", asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      name,
      description,
      targetCategory,
      targetNamePattern,
      propertyName,
      operator,
      expectedValue,
      unit,
      tolerance,
      severity,
      sourceDocument,
      sourcePage,
      isActive,
    } = req.body;

    const rule = await prisma.rule.update({
      where: { id },
      data: {
        name,
        description,
        targetCategory,
        targetNamePattern,
        propertyName,
        operator,
        expectedValue,
        unit,
        tolerance: tolerance !== undefined ? parseFloat(tolerance) : undefined,
        severity,
        sourceDocument,
        sourcePage: sourcePage !== undefined ? parseInt(sourcePage) : undefined,
        isActive,
      },
    });

    res.json(rule);
}));

/**
 * DELETE /api/compliance/rules/:id
 * Delete a rule
 */
router.delete("/rules/:id", asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await prisma.rule.delete({
      where: { id },
    });

    res.status(204).send();
}));

/**
 * POST /api/compliance/rules/bulk
 * Create multiple rules at once
 */
router.post("/rules/bulk", asyncHandler(async (req: Request, res: Response) => {
    const { rules, rulesetId } = req.body;

    if (!Array.isArray(rules) || !rulesetId) {
      throw badRequest("rules array and rulesetId are required", "MISSING_FIELDS");
    }

    // Verify ruleset exists
    const ruleset = await prisma.ruleset.findUnique({
      where: { id: rulesetId },
    });
    if (!ruleset) {
      throw notFound("Ruleset not found", "RULESET_NOT_FOUND");
    }

    const createdRules = await prisma.rule.createMany({
      data: rules.map(
        (rule: {
          name: string;
          targetCategory: string;
          propertyName: string;
          operator: string;
          expectedValue: string;
          description?: string;
          targetNamePattern?: string;
          unit?: string;
          tolerance?: string | number;
          severity?: string;
          sourceDocument?: string;
          sourcePage?: string | number;
          isActive?: boolean;
        }) => ({
          name: rule.name,
          targetCategory: rule.targetCategory,
          propertyName: rule.propertyName,
          operator: rule.operator,
          expectedValue: rule.expectedValue,
          rulesetId,
          description: rule.description,
          targetNamePattern: rule.targetNamePattern,
          unit: rule.unit,
          tolerance: rule.tolerance
            ? typeof rule.tolerance === "string"
              ? parseFloat(rule.tolerance)
              : rule.tolerance
            : null,
          severity: rule.severity || "WARNING",
          sourceDocument: rule.sourceDocument,
          sourcePage: rule.sourcePage
            ? typeof rule.sourcePage === "string"
              ? parseInt(rule.sourcePage)
              : rule.sourcePage
            : null,
          isActive: rule.isActive !== false,
        }),
      ),
    });

    res.status(201).json({ count: createdRules.count });
}));

// ============================================================
// CATEGORIES (Helper endpoint)
// ============================================================

/**
 * GET /api/compliance/categories
 * Get list of common Revit categories for UI dropdowns
 */
router.get("/categories", async (_req: Request, res: Response) => {
  const categories = {
    ELECTRICAL: [
      "Cable Trays",
      "Cable Tray Fittings",
      "Conduits",
      "Conduit Fittings",
      "Electrical Equipment",
      "Electrical Fixtures",
      "Lighting Fixtures",
      "Lighting Devices",
      "Communication Devices",
      "Data Devices",
      "Fire Alarm Devices",
      "Nurse Call Devices",
      "Security Devices",
      "Telephone Devices",
    ],
    STRUCTURAL: [
      "Structural Columns",
      "Structural Framing",
      "Structural Foundations",
      "Structural Connections",
      "Structural Rebar",
      "Structural Fabric Areas",
      "Structural Fabric Reinforcement",
    ],
    MEP: [
      "Ducts",
      "Duct Fittings",
      "Duct Accessories",
      "Air Terminals",
      "Flex Ducts",
      "Pipes",
      "Pipe Fittings",
      "Pipe Accessories",
      "Plumbing Fixtures",
      "Sprinklers",
      "Mechanical Equipment",
    ],
    ARCHITECTURAL: [
      "Walls",
      "Floors",
      "Roofs",
      "Ceilings",
      "Doors",
      "Windows",
      "Curtain Panels",
      "Curtain Wall Mullions",
      "Stairs",
      "Railings",
      "Ramps",
      "Casework",
      "Furniture",
      "Specialty Equipment",
    ],
  };

  res.json(categories);
});

/**
 * GET /api/compliance/operators
 * Get list of comparison operators for UI dropdowns
 */
router.get("/operators", async (_req: Request, res: Response) => {
  const operators = [
    {
      value: "==",
      label: "Equal to (==)",
      description: "Value must be exactly equal",
    },
    {
      value: ">=",
      label: "Greater or equal (>=)",
      description: "Value must be at least",
    },
    {
      value: "<=",
      label: "Less or equal (<=)",
      description: "Value must be at most",
    },
    {
      value: ">",
      label: "Greater than (>)",
      description: "Value must be more than",
    },
    {
      value: "<",
      label: "Less than (<)",
      description: "Value must be less than",
    },
    {
      value: "range",
      label: "In range",
      description: 'Value must be between min-max (e.g., "100-500")',
    },
    {
      value: "exists",
      label: "Exists",
      description: "Property must exist and have a value",
    },
    {
      value: "contains",
      label: "Contains",
      description: "Value must contain the specified text",
    },
  ];

  res.json(operators);
});

export default router;
