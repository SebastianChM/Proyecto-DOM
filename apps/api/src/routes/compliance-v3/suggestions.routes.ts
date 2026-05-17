import path from "path";
import { readFile, unlink, access } from "fs/promises";
import multer from "multer";
import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest } from "../../lib/errors";
import { suggestionService } from "../../services/compliance-v3/suggestion.service";
import {
  analyzeSchema,
  approveSchema,
  analysisIdParamSchema,
  packIdParamSchema,
} from "./schemas";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// gpt-4o-mini has a 128k token context window.
// Reserve headroom for system prompt + properties/categories dict + output (4k tokens).
// ~4 chars per token → 80k chars ≈ 20k tokens, safely within limits.
const MAX_TEXT_CHARS = 80_000;

const upload = multer({
  dest: path.join(process.cwd(), "uploads", "tmp"),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        ),
      );
    }
  },
});

/** Non-throwing temp file cleanup — failure here must never mask parsing errors. */
async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    await access(filePath);
    await unlink(filePath);
  } catch {
    // intentionally ignored — temp file cleanup is best-effort
  }
}

async function extractTextFromFile(
  filePath: string,
  originalName: string,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".txt") {
    return readFile(filePath, "utf-8");
  }

  if (ext === ".pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text as string;
  }

  if (ext === ".docx" || ext === ".doc") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

const router = Router({ mergeParams: true });

/**
 * POST /api/compliance-v3/packs/:packId/suggestions/analyze
 *
 * Analyse a regulatory text and return LLM-generated requirement suggestions.
 * The analysis is stored in Redis for 24 h (TTL).
 */
router.post(
  "/packs/:packId/suggestions/analyze",
  asyncHandler(async (req, res) => {
    const { packId } = packIdParamSchema.parse(req.params);
    const { text, discipline } = analyzeSchema.parse(req.body);
    const userId = (req as { user?: { id?: string } }).user?.id;

    const result = await suggestionService.analyze(
      packId,
      text,
      userId,
      discipline,
    );

    return res.status(201).json(result);
  }),
);

/**
 * POST /api/compliance-v3/suggestions/:analysisId/approve
 *
 * Approve one suggestion from an analysis — creates a DRAFT requirement in the pack.
 */
router.post(
  "/suggestions/:analysisId/approve",
  asyncHandler(async (req, res) => {
    const { analysisId } = analysisIdParamSchema.parse(req.params);
    const { index } = approveSchema.parse(req.body);
    const userId = (req as { user?: { id?: string } }).user?.id;

    const result = await suggestionService.approve(analysisId, index, userId);

    return res.status(201).json(result);
  }),
);

/**
 * POST /api/compliance-v3/suggestions/:analysisId/reject
 *
 * Reject an analysis (logs the action; Redis TTL handles cleanup).
 */
router.post(
  "/suggestions/:analysisId/reject",
  asyncHandler(async (req, res) => {
    const { analysisId } = analysisIdParamSchema.parse(req.params);

    await suggestionService.reject(analysisId);

    return res.status(204).send();
  }),
);

/**
 * POST /api/compliance-v3/packs/:packId/suggestions/analyze-file
 *
 * Upload a PDF/DOCX/TXT document, extract its text, and run LLM analysis.
 * Same response shape as /analyze.
 */
router.post(
  "/packs/:packId/suggestions/analyze-file",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest("No file uploaded", "FILE_UPLOAD_INVALID");
    }

    const { packId } = packIdParamSchema.parse(req.params);
    const discipline =
      typeof req.body.discipline === "string" && req.body.discipline !== "any"
        ? req.body.discipline
        : undefined;
    const userId = (req as { user?: { id?: string } }).user?.id;

    let rawText: string;
    try {
      rawText = await extractTextFromFile(req.file.path, req.file.originalname);
    } catch (err) {
      void safeDeleteFile(req.file.path);
      throw badRequest(
        `Failed to read document: ${err instanceof Error ? err.message : "unknown error"}`,
        "DOCUMENT_PARSE_ERROR",
      );
    }

    // Delete temp file immediately after successful extraction
    void safeDeleteFile(req.file.path);

    if (rawText.trim().length < 10) {
      throw badRequest(
        "Could not extract readable text from the document",
        "DOCUMENT_EMPTY",
      );
    }

    // Truncate to stay within LLM context window (see MAX_TEXT_CHARS constant)
    const text =
      rawText.length > MAX_TEXT_CHARS
        ? rawText.slice(0, MAX_TEXT_CHARS)
        : rawText;

    const result = await suggestionService.analyze(
      packId,
      text,
      userId,
      discipline,
    );
    return res.status(201).json(result);
  }),
);

export default router;
