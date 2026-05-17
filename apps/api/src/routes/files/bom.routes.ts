import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { BimQueryService } from "../../services/bim-query.service";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, notFound, conflict } from "../../lib/errors";
import { z } from "zod";

const router = Router();
const bimQueryService = new BimQueryService();

/** Round to 6 decimal places to prevent IEEE-754 float drift in accumulations. */
const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

// ─── Helpers ────────────────────────────────────────────────────────

interface RawBomItem {
  id: number;
  name: string;
  category: string;
  family: string;
  type: string;
  material: string;
  volume: number;
  area: number;
  length: number;
  count: number;
}

interface AggregatedBomItem {
  category: string;
  family: string;
  type: string;
  material: string;
  count: number;
  totalVolume: number;
  totalArea: number;
  totalLength: number;
  elementIds: number[];
}

interface BomSummaryCategory {
  category: string;
  count: number;
  uniqueTypes: number;
  totalVolume: number;
  totalArea: number;
  totalLength: number;
}

/** Aggregate raw BOM items by category + family + type + material */
function aggregateBom(items: RawBomItem[]): AggregatedBomItem[] {
  const map = new Map<string, AggregatedBomItem>();
  for (const item of items) {
    const key = `${item.category}||${item.family}||${item.type}||${item.material}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalVolume = r6(existing.totalVolume + (item.volume || 0));
      existing.totalArea = r6(existing.totalArea + (item.area || 0));
      existing.totalLength = r6(existing.totalLength + (item.length || 0));
      existing.elementIds.push(item.id);
    } else {
      map.set(key, {
        category: item.category,
        family: item.family,
        type: item.type,
        material: item.material,
        count: 1,
        totalVolume: item.volume || 0,
        totalArea: item.area || 0,
        totalLength: item.length || 0,
        elementIds: [item.id],
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) return catCmp;
    return b.count - a.count;
  });
}

/** Build summary stats per category */
function buildSummary(aggregated: AggregatedBomItem[]): BomSummaryCategory[] {
  const map = new Map<string, BomSummaryCategory>();
  for (const item of aggregated) {
    const existing = map.get(item.category);
    if (existing) {
      existing.count += item.count;
      existing.uniqueTypes += 1;
      existing.totalVolume = r6(existing.totalVolume + item.totalVolume);
      existing.totalArea = r6(existing.totalArea + item.totalArea);
      existing.totalLength = r6(existing.totalLength + item.totalLength);
    } else {
      map.set(item.category, {
        category: item.category,
        count: item.count,
        uniqueTypes: 1,
        totalVolume: item.totalVolume,
        totalArea: item.totalArea,
        totalLength: item.totalLength,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Validate file exists and is ready, return file record */
async function getReadyFile(fileId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !file.apsUrn) {
    throw notFound("File not found or not processed", "FILE_NOT_FOUND");
  }
  if (file.status !== "READY") {
    throw badRequest(
      "File not ready for BOM extraction. Current status: " + file.status,
      "FILE_NOT_READY",
    );
  }
  return file;
}

const MOCK_BOM: RawBomItem[] = [
  {
    id: 1,
    name: "Mock Wall A",
    category: "Walls",
    family: "Basic Wall",
    type: "Generic 200mm",
    material: "Concrete",
    volume: 10.5,
    area: 20,
    length: 5,
    count: 1,
  },
  {
    id: 2,
    name: "Mock Wall B",
    category: "Walls",
    family: "Basic Wall",
    type: "Generic 200mm",
    material: "Concrete",
    volume: 12.0,
    area: 24,
    length: 6,
    count: 1,
  },
  {
    id: 3,
    name: "Mock Door",
    category: "Doors",
    family: "Single-Flush",
    type: "0915 x 2134mm",
    material: "Wood",
    volume: 2.1,
    area: 2,
    length: 0,
    count: 1,
  },
  {
    id: 4,
    name: "Mock Window",
    category: "Windows",
    family: "Fixed",
    type: "0915 x 1220mm",
    material: "Glass",
    volume: 1.2,
    area: 1.5,
    length: 0,
    count: 1,
  },
];

/** Get raw BOM items for a file (mock or real) */
async function getRawBom(file: {
  apsUrn: string | null;
}): Promise<RawBomItem[]> {
  if (file.apsUrn?.startsWith("local-")) {
    return MOCK_BOM;
  }
  try {
    return (await bimQueryService.getBOM(file.apsUrn!)) as RawBomItem[];
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("APS_MODEL_NOT_READY")) {
      throw conflict(
        "Model properties are not yet extracted.",
        "APS_MODEL_NOT_READY",
      );
    }
    throw error;
  }
}

/**
 * @swagger
 * /files/{id}/bom:
 *   get:
 *     summary: Get BOM (Bill of Materials) — aggregated, filtered, paginated
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [aggregated, raw], default: aggregated }
 *         description: "aggregated = grouped by category+family+type (default), raw = individual elements"
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: "Filter by category (exact match)"
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: "Search in name, family, type, material (case-insensitive)"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: BOM data with summary, pagination, and categories
 */
router.get(
  "/:id/bom",
  asyncHandler(async (req: Request, res: Response) => {
    const parsedId = z.string().uuid().safeParse(req.params.id);
    if (!parsedId.success)
      throw badRequest("Invalid file ID format", "INVALID_ID");
    const file = await getReadyFile(parsedId.data);

    const mode = (req.query.mode as string) || "aggregated";
    const categoryFilter = req.query.category as string | undefined;
    const search = ((req.query.search as string) || "").toLowerCase();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(req.query.pageSize as string) || 50),
    );

    logger.debug(`[FILES_BOM] Using URN: ${file.apsUrn}`);

    const rawBom = await getRawBom(file);
    logger.info(`[FILES_BOM] Raw elements: ${rawBom.length}`);

    // Filter raw items
    let filtered = rawBom;
    if (categoryFilter) {
      filtered = filtered.filter((i) => i.category === categoryFilter);
    }
    if (search) {
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(search) ||
          i.family.toLowerCase().includes(search) ||
          i.type.toLowerCase().includes(search) ||
          i.material.toLowerCase().includes(search),
      );
    }

    // Build summary from ALL filtered items (before pagination)
    const aggregated = aggregateBom(filtered);
    const summary = buildSummary(aggregated);

    // Choose data set based on mode
    const dataset = mode === "raw" ? filtered : aggregated;
    const totalItems = dataset.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const offset = (page - 1) * pageSize;
    const pageData = dataset.slice(offset, offset + pageSize);

    // Available categories (from full unfiltered raw BOM)
    const categories = [...new Set(rawBom.map((i) => i.category))].sort();

    res.json({
      meta: {
        mode,
        totalRawElements: rawBom.length,
        totalFiltered: filtered.length,
        totalAggregated: aggregated.length,
        page,
        pageSize,
        totalPages,
        totalItems,
      },
      categories,
      summary,
      data: pageData,
    });
  }),
);

/**
 * GET /:id/bom/export
 * Export BOM as CSV (aggregated by default)
 * Query: ?mode=raw|aggregated (default: aggregated)
 */
router.get(
  "/:id/bom/export",
  asyncHandler(async (req: Request, res: Response) => {
    const parsedExportId = z.string().uuid().safeParse(req.params.id);
    if (!parsedExportId.success)
      throw badRequest("Invalid file ID format", "INVALID_ID");
    const file = await getReadyFile(parsedExportId.data);
    const mode = (req.query.mode as string) || "aggregated";

    const rawBom = await getRawBom(file);

    if (!rawBom || rawBom.length === 0) {
      throw notFound("No BOM data available", "BOM_EMPTY");
    }

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    let csv: string;

    if (mode === "raw") {
      const columns = [
        "id",
        "name",
        "category",
        "family",
        "type",
        "material",
        "volume",
        "area",
        "length",
        "count",
      ];
      const header = columns.join(",");
      const rows = rawBom.map((item) =>
        columns
          .map((col) =>
            escapeCsv((item as unknown as Record<string, unknown>)[col]),
          )
          .join(","),
      );
      csv = [header, ...rows].join("\n");
    } else {
      // Aggregated export
      const aggregated = aggregateBom(rawBom);
      const header =
        "Category,Family,Type,Material,Count,Total Volume (m³),Total Area (m²),Total Length (m)";
      const rows = aggregated.map((item) =>
        [
          escapeCsv(item.category),
          escapeCsv(item.family),
          escapeCsv(item.type),
          escapeCsv(item.material),
          item.count,
          item.totalVolume.toFixed(3),
          item.totalArea.toFixed(3),
          item.totalLength.toFixed(3),
        ].join(","),
      );
      csv = [header, ...rows].join("\n");
    }

    const safeName = (file.name || "bom").replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="BOM_${safeName}_${mode}.csv"`,
    );
    res.send(csv);
  }),
);

/**
 * POST /bom/compare
 * Compare BOMs from two files (uses aggregated view)
 * Body: { fileIdA: string, fileIdB: string }
 */
router.post(
  "/bom/compare",
  asyncHandler(async (req: Request, res: Response) => {
    const compareSchema = z.object({
      fileIdA: z.string().uuid(),
      fileIdB: z.string().uuid(),
    });
    const parsedBody = compareSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw badRequest(
        "fileIdA and fileIdB must be valid UUIDs",
        "INVALID_PARAMS",
      );
    }
    const { fileIdA, fileIdB } = parsedBody.data;

    const [fileA, fileB] = await Promise.all([
      prisma.file.findUnique({ where: { id: fileIdA } }),
      prisma.file.findUnique({ where: { id: fileIdB } }),
    ]);

    if (!fileA?.apsUrn || !fileB?.apsUrn) {
      throw notFound(
        "One or both files not found or not processed",
        "FILE_NOT_FOUND",
      );
    }
    if (fileA.status !== "READY" || fileB.status !== "READY") {
      throw badRequest(
        "Both files must be READY for comparison",
        "FILE_NOT_READY",
      );
    }

    const [rawA, rawB] = await Promise.all([
      getRawBom(fileA),
      getRawBom(fileB),
    ]);

    // Aggregate both BOMs
    const aggA = aggregateBom(rawA);
    const aggB = aggregateBom(rawB);

    // Build lookup maps by category+family+type+material
    const key = (item: AggregatedBomItem) =>
      `${item.category}::${item.family}::${item.type}::${item.material}`;

    const mapA = new Map<string, AggregatedBomItem>();
    for (const item of aggA) mapA.set(key(item), item);

    const mapB = new Map<string, AggregatedBomItem>();
    for (const item of aggB) mapB.set(key(item), item);

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

    const added: { key: string; countB: number }[] = [];
    const removed: { key: string; countA: number }[] = [];
    const changed: {
      key: string;
      countA: number;
      countB: number;
      volumeDiff: number;
      areaDiff: number;
    }[] = [];
    const unchanged: { key: string; count: number }[] = [];

    for (const k of allKeys) {
      const inA = mapA.get(k);
      const inB = mapB.get(k);
      if (!inA) {
        added.push({ key: k, countB: inB!.count });
      } else if (!inB) {
        removed.push({ key: k, countA: inA.count });
      } else if (inA.count !== inB.count) {
        changed.push({
          key: k,
          countA: inA.count,
          countB: inB.count,
          volumeDiff: r6(inB.totalVolume - inA.totalVolume),
          areaDiff: r6(inB.totalArea - inA.totalArea),
        });
      } else {
        unchanged.push({ key: k, count: inA.count });
      }
    }

    res.json({
      fileA: {
        id: fileA.id,
        name: fileA.name,
        totalRawElements: rawA.length,
        totalAggregated: aggA.length,
      },
      fileB: {
        id: fileB.id,
        name: fileB.name,
        totalRawElements: rawB.length,
        totalAggregated: aggB.length,
      },
      summary: {
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        unchanged: unchanged.length,
      },
      details: { added, removed, changed },
    });
  }),
);

export default router;
