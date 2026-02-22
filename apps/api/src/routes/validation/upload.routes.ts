import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";

const router = Router();

// Define clean interface for Request with User
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  session?: {
    user?: {
      id: string;
    };
  };
}

// Configuration: storage path
// Use absolute path relative to project root or configurable env
const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "et-documents");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    // Sanitize original name to prevent path traversal or weird chars
    const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueName = `${Date.now()}-${uuidv4()}-${sanitizedOriginal}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = [".pdf", ".doc", ".docx", ".md", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed: ${allowedExtensions.join(", ")}`,
        ),
      );
    }
  },
});

/**
 * POST /api/validation/upload-et
 * Upload ET document linked to a project
 */
router.post(
  "/upload-et",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { projectId } = req.body;
      if (!projectId) {
        // Cleanup uploaded file if validation fails
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "projectId is required" });
      }

      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true }, // Select only ID for efficiency
      });

      if (!project) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "Project not found" });
      }

      // Determine User ID (Session or Fallback)
      // Note: In production, strictly enforce session user.
      // Fallback kept for development convenience but marked clearly.
      const authReq = req as AuthenticatedRequest;
      let userId = authReq.session?.user?.id || authReq.user?.id;

      if (!userId) {
        // DEV FALLBACK: Use first user if no session (TO BE REMOVED IN PROD)
        const firstUser = await prisma.user.findFirst({ select: { id: true } });
        userId = firstUser?.id;
      }

      if (!userId) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(401).json({ error: "Authentication required" });
      }

      // Create File Record
      const etDocument = await prisma.file.create({
        data: {
          name: req.file.originalname,
          originalName: req.file.originalname,
          type: "ET_DOCUMENT",
          size: req.file.size,
          s3Key: req.file.path, // Using local path as 'key' for now
          status: "READY",
          projectId: projectId,
          uploadedBy: userId,
        },
      });

      logger.info(`[UPLOAD] ET Document created: ${etDocument.id}`);

      res.status(201).json({
        id: etDocument.id,
        name: etDocument.name,
        size: etDocument.size,
        path: req.file.path,
        createdAt: etDocument.createdAt,
      });
    } catch (error: unknown) {
      logger.error("[UPLOAD] Error uploading ET document", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Attempt cleanup on error
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }

      res.status(500).json({
        error: "Failed to upload ET document",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
