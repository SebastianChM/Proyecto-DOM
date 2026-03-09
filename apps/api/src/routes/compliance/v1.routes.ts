import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { MopParserService } from "../../services/mop-parser.service";
import { parserService } from "../../services/validation/parser.service";
import { BimQueryService } from "../../services/bim-query.service";
import { ComplianceKernelService } from "../../services/compliance-kernel.service";
import prisma from "../../lib/prisma";
import { apsOssService } from "../../services/aps/oss.service";
import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import { HierarchicalParserService } from "../../services/hierarchical-parser.service";
import { HierarchicalSpecProcessor } from "../../services/hierarchical-spec-processor";
import { NormativeParserService } from "../../services/normative-parser.service";
import { SupremacyEngineService } from "../../services/supremacy-engine.service";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, conflict } from "../../lib/errors";

const router = Router();
const upload = multer({ dest: "uploads/" });

// Instantiate Services
const mopParser = new MopParserService();
// const specParser = new SpecParserService(); // Removed
const bimQuery = new BimQueryService();
const kernel = new ComplianceKernelService();
const hierarchyParser = new HierarchicalParserService();
const hierarchyProcessor = new HierarchicalSpecProcessor();
const normativeParser = new NormativeParserService();
const supremacyEngine = new SupremacyEngineService();

// Helper: Ensure URN is URL-Safe Base64
function toSafeUrn(urn: string): string {
  if (!urn) return "";
  let safeUrn = urn;
  if (urn.startsWith("urn:")) {
    safeUrn = Buffer.from(urn).toString("base64");
  }
  return safeUrn.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Helper: Download a file from Project storage (S3/APS) to a temp location
 * Returns a Multer-like file object
 */
async function downloadProjectFile(
  fileId: string,
): Promise<Express.Multer.File> {
  const dbFile = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!dbFile) {
    throw new Error("Project file not found");
  }

  if (!dbFile.apsUrn || dbFile.apsUrn.startsWith("local-")) {
    throw new Error("Project file not available for analysis (no URN)");
  }

  // Decode URN to get object key
  const decodedUrn = Buffer.from(dbFile.apsUrn, "base64").toString("utf-8");
  const match = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);
  const objectKey = match ? match[1] : dbFile.s3Key;

  if (!objectKey) {
    throw new Error("Invalid file record (missing object key)");
  }

  // Get signed URL
  const signedUrl = await apsOssService.getSignedUrl(objectKey);
  if (!signedUrl) {
    throw new Error("Failed to get download URL for project file");
  }

  // Download
  const response = await axios.get(signedUrl, { responseType: "arraybuffer" });
  const tempFilePath = path.join(
    os.tmpdir(),
    `spec_${Date.now()}_${dbFile.name}`,
  );
  fs.writeFileSync(tempFilePath, Buffer.from(response.data));

  return {
    path: tempFilePath,
    originalname: dbFile.name,
    mimetype: "application/pdf", // Assumed for now, or derive from dbFile.type
    size: dbFile.size || 0,
    fieldname: "file",
    encoding: "7bit",
    buffer: Buffer.from([]), // Multer diskStorage doesn't provide buffer, empty is fine here
    destination: os.tmpdir(),
    filename: path.basename(tempFilePath),
    stream: fs.createReadStream(tempFilePath),
  };
}

// ==================== ROUTES ====================

/**
 * GET /api/compliance/model-status
 */
router.get("/model-status", asyncHandler(async (req: Request, res: Response) => {
    const urn = req.query.urn as string;
    if (!urn) throw badRequest("URN required", "MISSING_FIELDS");

    const safeUrn = toSafeUrn(urn);

    try {
      const manifest = await modelDerivativeService.getManifest(safeUrn);
      res.json({
        status: manifest.status,
        progress: manifest.progress,
        region: manifest.region,
        messages: manifest.messages,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number } };
      if (err.response?.status === 404) {
        return res.json({
          status: "failed",
          messages: [{ type: "error", message: "Model Not Found (404)" }],
        });
      }
      throw error;
    }
}));

/**
 * POST /api/compliance/analyze/mop
 */
router.post(
  "/analyze/mop",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
      if (!req.file) {
        throw badRequest("No file uploaded", "FILE_UPLOAD_INVALID");
      }

      const filePath = req.file.path;

      // 1. Extract Text
      const docResult = await parserService.parseDocument(
        filePath,
        req.file.mimetype,
      );

      // 2. Parse MOP
      const sections = mopParser.parse(docResult.text);
      const structuralSections = mopParser.filterByDiscipline(
        sections,
        "STRUCTURAL",
      );

      // Cleanup
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      res.json({
        success: true,
        metadata: docResult.metadata,
        stats: {
          totalSections: sections.length,
          structuralSections: structuralSections.length,
        },
        data: structuralSections,
      });
  }),
);

/**
 * POST /api/compliance/analyze/spec
 */
router.post(
  "/analyze/spec",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "normativeFile", maxCount: 1 },
  ]),
  asyncHandler(async (req: Request, res: Response) => {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let specFile = files?.["file"]?.[0] || null;
      const normFile = files?.["normativeFile"]?.[0] || null;
      const { projectFileId } = req.body;

      // Handle Project File (download if needed)
      if (projectFileId && !specFile) {
        try {
          specFile = await downloadProjectFile(projectFileId);
        } catch (err) {
          throw badRequest(
            err instanceof Error
              ? err.message
              : "Failed to download project file",
            "PROJECT_FILE_DOWNLOAD_FAILED"
          );
        }
      }

      if (!specFile && !normFile) {
        throw badRequest(
          "No specification or normative file provided",
          "FILE_UPLOAD_INVALID"
        );
      }

      // 1. Parse Project Spec
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let specRequirements: any[] = [];

      if (specFile) {
        logger.info(`[COMPLIANCE_V1] Parsing Spec: ${specFile.originalname}`);

        if (specFile.mimetype === "application/pdf") {
          const tree = await hierarchyParser.parse(specFile.path);
          specRequirements = hierarchyProcessor.processTree(tree, "", "Spec");
          logger.info(
            `[COMPLIANCE_V1] Extracted ${specRequirements.length} requirements`,
          );
        } else {
          // Fallback for non-PDF
          // Fallback for non-PDF
          const docResult = await parserService.parseDocument(
            specFile.path,
            specFile.mimetype,
          );
          const specs = parserService.extractSpecifications(docResult.text);
          specRequirements = specs.map((r) => ({
            ...r,
            source: "Spec",
          }));
        }

        // Cleanup
        if (fs.existsSync(specFile.path)) fs.unlinkSync(specFile.path);
      }

      // 2. Parse Normative
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let normRequirements: any[] = [];
      if (normFile) {
        logger.info(
          `[COMPLIANCE_V1] Parsing Normative: ${normFile.originalname}`,
        );
        normRequirements = await normativeParser.parse(normFile.path);
        if (fs.existsSync(normFile.path)) fs.unlinkSync(normFile.path);
      }

      // 3. Resolve Supremacy
      let finalRequirements = specRequirements;
      const stats: Record<string, unknown> = {
        specRules: specRequirements.length,
        normRules: normRequirements.length,
      };

      if (normRequirements.length > 0) {
        finalRequirements = supremacyEngine.resolveActiveRules(
          specRequirements,
          normRequirements,
        );
        stats.supremacyResolved = true;
      }

      stats.totalRules = finalRequirements.length;

      res.json({
        success: true,
        stats,
        data: finalRequirements,
      });
  }),
);

/**
 * POST /api/compliance/verify
 */
router.post(
  "/verify",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
      const { urn, checklist } = req.body;

      if (!req.file && !checklist) {
        throw badRequest(
          "No specification file OR checklist provided",
          "FILE_UPLOAD_INVALID"
        );
      }
      if (!urn) {
        throw badRequest("No Model URN provided", "MISSING_FIELDS");
      }

      const safeUrn = toSafeUrn(urn);

      // 1. Parsing Phase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let requirements: any[] = [];
      let durationMs = 0;

      if (checklist) {
        try {
          requirements =
            typeof checklist === "string" ? JSON.parse(checklist) : checklist;
        } catch {
          throw badRequest("Invalid checklist format", "INVALID_CHECKLIST");
        }
      } else if (req.file) {
        // Classic file mode
        let text = "";
        if (req.file.mimetype === "text/plain") {
          text = fs.readFileSync(req.file.path, "utf-8");
        } else {
          const docResult = await parserService.parseDocument(
            req.file.path,
            req.file.mimetype,
          );
          text = docResult.text;
        }
        const specs = parserService.extractSpecifications(text);
        requirements = specs;
        // durationMs not supported in new parser explicitly yet, assuming fast enough or irrelevant
        durationMs = 0;

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }

      // Filter Logic
      const discipline = (req.body.discipline || "ALL").toUpperCase();
      if (discipline !== "ALL") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requirements = requirements.filter((r: any) => {
          const cat = (r.derivedCategory || "").toUpperCase();
          const rules: Record<string, string[]> = {
            STRUCTURAL: ["CONCRETE", "STEEL", "STRUCT", "HORMIG", "ACERO"],
            MEP: ["MEP", "ELEC", "MECH", "PIPE", "DUCT"],
            ARCHITECTURAL: ["ARCH", "WALL", "ROOM", "FINISH"],
          };
          return rules[discipline]?.some((k) => cat.includes(k)) ?? true;
        });
      }

      // 2. Extraction & 3. Evaluation
      let modelProps;
      try {
        modelProps = await bimQuery.queryModel(safeUrn);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("APS_MODEL_NOT_READY")) {
          throw conflict("Model is still processing", "APS_MODEL_NOT_READY");
        }
        throw error;
      }
      const incidents = kernel.evaluate(requirements, modelProps);

      res.json({
        success: true,
        stats: {
          requirementsChecked: requirements.length,
          elementsScanned: modelProps.length,
          incidentsFound: incidents.length,
          durationMs,
        },
        incidents,
        // Map strictly needed fields
        checklist: requirements.map(
          (req: {
            id?: string;
            originalText?: string;
            derivedCategory?: string;
            page?: number;
          }) => ({
            id: req.id,
            description: req.originalText,
            category: req.derivedCategory || "General",
            page: req.page,
            originalText: req.originalText,
          }),
        ),
        scannedElements: modelProps.map((p) => ({
          id: p.elementId,
          name: p.name,
          category: p.category,
        })),
      });
  }),
);

export default router;
