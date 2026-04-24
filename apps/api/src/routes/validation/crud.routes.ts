import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, notFound } from "../../lib/errors";

const router = Router();

// ==================== VALIDATION RUNS ====================

/**
 * Create a new validation run
 * POST /api/validation
 */
router.post("/", asyncHandler(async (req: Request, res: Response) => {
    const {
      fileId,
      fileName,
      fileUrn,
      projectId,
      userId,
      validationType,
      validationRules,
    } = req.body;

    const validationRun = await prisma.validationRun.create({
      data: {
        fileId,
        fileName,
        fileUrn,
        projectId,
        userId,
        validationType,
        validationRules: validationRules
          ? JSON.stringify(validationRules)
          : null,
        status: "PENDING",
      },
    });

    res.status(201).json({ success: true, data: validationRun });
}));

/**
 * Get all validation runs
 * GET /api/validation?projectId=xxx&fileId=xxx&userId=xxx&limit=10
 */
router.get("/", asyncHandler(async (req: Request, res: Response) => {
    const { projectId, fileId, userId, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    const where: Record<string, string> = {};
    if (projectId) where.projectId = projectId as string;
    if (fileId) where.fileId = fileId as string;
    if (userId) where.userId = userId as string;
    if (status) where.status = status as string;

    const validationRuns = await prisma.validationRun.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        issues: {
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
          },
        },
        _count: {
          select: {
            issues: true,
            notifications: true,
          },
        },
      },
    });

    res.json({ success: true, data: validationRuns });
}));

/**
 * Get issue statistics for a file or project
 * MOVED UP to avoid conflict with /:id
 * GET /api/validation/stats/summary
 */
router.get("/stats/summary", asyncHandler(async (req: Request, res: Response) => {
    const { fileId, projectId, userId } = req.query;

    const where: Record<string, string> = {};
    if (fileId) where.fileId = fileId as string;
    if (projectId) where.projectId = projectId as string;
    if (userId) where.userId = userId as string;

    const validations = await prisma.validationRun.findMany({
      where,
      include: {
        issues: {
          select: {
            type: true,
            severity: true,
            status: true,
          },
        },
      },
    });

    // Calculate statistics
    const stats = {
      totalValidations: validations.length,
      totalIssues: 0,
      openIssues: 0,
      resolvedIssues: 0,
      byType: {
        MISSING: 0,
        MISMATCH: 0,
        UNDOCUMENTED: 0,
        DUPLICATE: 0,
        INVALID: 0,
      },
      bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      latestValidation: validations[0] || null,
    };

    validations.forEach((v) => {
      v.issues.forEach((issue) => {
        stats.totalIssues++;
        if (issue.status === "OPEN") stats.openIssues++;
        else if (issue.status === "RESOLVED") stats.resolvedIssues++;

        stats.byType[issue.type as keyof typeof stats.byType]++;
        stats.bySeverity[issue.severity as keyof typeof stats.bySeverity]++;
      });
    });

    res.json({ success: true, data: stats });
}));

/**
 * Compare two validation runs to detect changes
 * GET /api/validation/compare/:id1/:id2
 */
router.get("/compare/:id1/:id2", asyncHandler(async (req: Request, res: Response) => {
    const id1 = req.params.id1 as string;
    const id2 = req.params.id2 as string;

    const [validation1, validation2] = await Promise.all([
      prisma.validationRun.findUnique({
        where: { id: id1 },
        include: { issues: true },
      }),
      prisma.validationRun.findUnique({
        where: { id: id2 },
        include: { issues: true },
      }),
    ]);

    if (!validation1 || !validation2) {
      throw notFound("Validation run not found", "VALIDATION_RUN_NOT_FOUND");
    }

    // Compare issues
    const issues1Map = new Map(
      validation1.issues.map((i) => [i.elementTag || i.elementId, i]),
    );
    const issues2Map = new Map(
      validation2.issues.map((i) => [i.elementTag || i.elementId, i]),
    );

    const newIssues = validation2.issues.filter((i2) => {
      const key = i2.elementTag || i2.elementId;
      return key && !issues1Map.has(key);
    });

    const resolvedIssues = validation1.issues.filter((i1) => {
      const key = i1.elementTag || i1.elementId;
      return key && !issues2Map.has(key);
    });

    const changedIssues = validation2.issues.filter((i2) => {
      const key = i2.elementTag || i2.elementId;
      const i1 = key ? issues1Map.get(key) : null;
      if (!i1) return false;
      return i1.type !== i2.type || i1.message !== i2.message;
    });

    const comparison = {
      validation1: {
        id: validation1.id,
        createdAt: validation1.createdAt,
        totalIssues: validation1.issues.length,
      },
      validation2: {
        id: validation2.id,
        createdAt: validation2.createdAt,
        totalIssues: validation2.issues.length,
      },
      changes: {
        newIssues: newIssues.length,
        resolvedIssues: resolvedIssues.length,
        changedIssues: changedIssues.length,
        details: {
          new: newIssues,
          resolved: resolvedIssues,
          changed: changedIssues,
        },
      },
    };

    res.json({ success: true, data: comparison });
}));

/**
 * Get a specific validation run
 * GET /api/validation/:id
 */
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const validationRun = await prisma.validationRun.findUnique({
      where: { id },
      include: {
        issues: {
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        },
        notifications: true,
      },
    });

    if (!validationRun) {
      throw notFound("Validation run not found", "VALIDATION_RUN_NOT_FOUND");
    }

    res.json({ success: true, data: validationRun });
}));

/**
 * Update validation run (complete, fail, etc.)
 * PATCH /api/validation/:id
 */
router.patch("/:id", asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const {
      status,
      totalElements,
      missingCount,
      mismatchCount,
      undocumentedCount,
    } = req.body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (totalElements !== undefined) updateData.totalElements = totalElements;
    if (missingCount !== undefined) updateData.missingCount = missingCount;
    if (mismatchCount !== undefined) updateData.mismatchCount = mismatchCount;
    if (undocumentedCount !== undefined)
      updateData.undocumentedCount = undocumentedCount;

    if (status === "COMPLETED" || status === "FAILED") {
      updateData.completedAt = new Date();
    }

    const validationRun = await prisma.validationRun.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: validationRun });
}));

// ==================== VALIDATION ISSUES ====================

/**
 * Create validation issues (bulk)
 * POST /api/validation/:id/issues
 */
router.post("/:id/issues", asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { issues } = req.body;

    if (!Array.isArray(issues)) {
      throw badRequest("Issues must be an array", "INVALID_ISSUES");
    }

    // Create issues in bulk
    const createdIssues = await prisma.validationIssue.createMany({
      data: issues.map((issue: Record<string, unknown>) => ({
        validationRunId: id,
        type: issue.type as string,
        severity: (issue.severity as string) || "MEDIUM",
        status: "OPEN",
        elementTag: issue.elementTag as string,
        elementType: issue.elementType as string,
        elementId: issue.elementId as string,
        message: issue.message as string,
        description: issue.description as string,
        location: issue.location ? JSON.stringify(issue.location) : null,
        expectedValue: issue.expectedValue as string,
        actualValue: issue.actualValue as string,
      })),
    });

    // Update validation run counts
    const issueCounts = issues.reduce(
      (
        acc: { missing: number; mismatch: number; undocumented: number },
        issue: { type: string },
      ) => {
        if (issue.type === "MISSING") acc.missing++;
        else if (issue.type === "MISMATCH") acc.mismatch++;
        else if (issue.type === "UNDOCUMENTED") acc.undocumented++;
        return acc;
      },
      { missing: 0, mismatch: 0, undocumented: 0 },
    );

    await prisma.validationRun.update({
      where: { id },
      data: {
        missingCount: { increment: issueCounts.missing },
        mismatchCount: { increment: issueCounts.mismatch },
        undocumentedCount: { increment: issueCounts.undocumented },
      },
    });

    res
      .status(201)
      .json({ success: true, data: { count: createdIssues.count } });
}));

/**
 * Get issues for a validation run
 * GET /api/validation/:id/issues?type=MISSING&status=OPEN
 */
router.get("/:id/issues", asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { type, status, severity, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 50));

    const where: Record<string, unknown> = { validationRunId: id };
    if (type) where.type = type as string;
    if (status) where.status = status as string;
    if (severity) where.severity = severity as string;
    if (search) {
      const term = (search as string).trim();
      where.OR = [
        { ruleName: { contains: term, mode: "insensitive" } },
        { elementName: { contains: term, mode: "insensitive" } },
        { elementCategory: { contains: term, mode: "insensitive" } },
        { propertyName: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, issues, severityCounts] = await Promise.all([
      prisma.validationIssue.count({ where }),
      prisma.validationIssue.findMany({
        where,
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // Counts by severity (unfiltered by search/status for summary pills)
      prisma.validationIssue.groupBy({
        by: ["severity"],
        where: { validationRunId: id },
        _count: true,
      }),
    ]);

    const counts = severityCounts.reduce((acc, s) => {
      acc[s.severity] = s._count;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      counts,
      data: issues,
    });
}));

/**
 * Update an issue (resolve, acknowledge, etc.)
 * PATCH /api/validation/issues/:issueId
 */
router.patch("/issues/:issueId", asyncHandler(async (req: Request, res: Response) => {
    const issueId = req.params.issueId as string;
    const { status, resolvedBy, resolutionNotes, severity } = req.body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (severity) updateData.severity = severity;
    if (resolvedBy) updateData.resolvedBy = resolvedBy;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;

    if (status === "RESOLVED") {
      updateData.resolvedAt = new Date();
    }

    const issue = await prisma.validationIssue.update({
      where: { id: issueId },
      data: updateData,
    });

    res.json({ success: true, data: issue });
}));

export default router;
