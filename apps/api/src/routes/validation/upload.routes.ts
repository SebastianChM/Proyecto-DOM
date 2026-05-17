import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { unlink } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, unauthorized, notFound } from "../../lib/errors";

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

/** Best-effort async file cleanup — never throws. */
async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // intentionally ignored — cleanup is best-effort
  }
}

/**
 * POST /api/validation/upload-et
 * Upload ET document linked to a project
 */
router.post(
  "/upload-et",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw badRequest("No file uploaded", "FILE_UPLOAD_INVALID");
    }

    const { projectId } = req.body;
    if (!projectId) {
      await safeDeleteFile(req.file.path);
      throw badRequest("projectId is required", "MISSING_PROJECT_ID");
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      await safeDeleteFile(req.file.path);
      throw notFound("Project not found", "PROJECT_NOT_FOUND");
    }

    const authReq = req as AuthenticatedRequest;
    const userId = authReq.session?.user?.id;

    if (!userId) {
      await safeDeleteFile(req.file.path);
      throw unauthorized("Authentication required");
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
  }),
);

export default router;
