import { Router } from "express";
import prisma from "../lib/prisma";
import { cacheService } from "../lib/redis";
import { asyncHandler } from "../lib/async-handler";
import { unauthorized } from "../lib/errors";

const router = Router();

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *       500:
 *         description: Server error
 */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw unauthorized("Authentication required");
    }

    const cacheKey = `cache:dashboard:stats:${userId}`;

    // Cache stats for 5 minutes
    const stats = await cacheService.getOrSet(
      cacheKey,
      async () => {
        // 1. Total Projects
        const totalProjects = await prisma.project.count({
          where: {
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
        });

        // 2. Total Files & Size (Aggregation)
        const filesAgg = await prisma.file.aggregate({
          where: {
            project: {
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
          },
          _count: { id: true },
          _sum: { size: true },
        });

        // 3. Active Models (Ready & 3D)
        const activeModels = await prisma.file.count({
          where: {
            project: {
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
            status: "READY",
            type: { in: ["RVT", "IFC", "NWC", "DWG"] },
          },
        });

        // 4. Recent Activity (Last 5 modified projects)
        const recentProjects = await prisma.project.findMany({
          where: {
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
          take: 5,
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { files: true } },
          },
        });

        // 5. Check if any file is processing
        const processingCount = await prisma.file.count({
          where: {
            project: {
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
            status: { in: ["TRANSLATING", "PROCESSING", "PENDING"] },
            updatedAt: {
              gte: new Date(Date.now() - 4 * 60 * 60 * 1000), // Ignore jobs older than 4 hours
            },
          },
        });

        // 6. Month-over-month trends — compare last 30 days vs previous 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const [
          projectsThisPeriod,
          projectsLastPeriod,
          filesThisPeriod,
          filesLastPeriod,
          activeModelsThisPeriod,
          activeModelsLastPeriod,
        ] = await Promise.all([
          prisma.project.count({
            where: {
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
              createdAt: { gte: thirtyDaysAgo },
            },
          }),
          prisma.project.count({
            where: {
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
              createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
            },
          }),
          prisma.file.count({
            where: {
              project: {
                OR: [{ ownerId: userId }, { members: { some: { userId } } }],
              },
              createdAt: { gte: thirtyDaysAgo },
            },
          }),
          prisma.file.count({
            where: {
              project: {
                OR: [{ ownerId: userId }, { members: { some: { userId } } }],
              },
              createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
            },
          }),
          prisma.file.count({
            where: {
              project: {
                OR: [{ ownerId: userId }, { members: { some: { userId } } }],
              },
              status: "READY",
              type: { in: ["RVT", "IFC", "NWC", "DWG"] },
              updatedAt: { gte: thirtyDaysAgo },
            },
          }),
          prisma.file.count({
            where: {
              project: {
                OR: [{ ownerId: userId }, { members: { some: { userId } } }],
              },
              status: "READY",
              type: { in: ["RVT", "IFC", "NWC", "DWG"] },
              updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
            },
          }),
        ]);

        const computeTrend = (
          current: number,
          previous: number,
        ): string | null => {
          if (previous === 0 && current === 0) return null;
          if (previous === 0) return current > 0 ? "New" : null;
          const diff = current - previous;
          const pct = Math.round((diff / previous) * 100);
          return pct >= 0 ? `+${pct}%` : `${pct}%`;
        };

        return {
          totalProjects,
          totalFiles: filesAgg._count.id,
          totalSize: filesAgg._sum.size || 0,
          activeModels,
          recentActivity: recentProjects,
          isProcessing: processingCount > 0,
          trends: {
            projects: computeTrend(projectsThisPeriod, projectsLastPeriod),
            files: computeTrend(filesThisPeriod, filesLastPeriod),
            activeModels: computeTrend(
              activeModelsThisPeriod,
              activeModelsLastPeriod,
            ),
          },
        };
      },
      10, // 10 seconds TTL for better real-time status
    );

    res.json(stats);
  }),
);

export default router;
