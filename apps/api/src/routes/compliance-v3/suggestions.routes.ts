import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { suggestionService } from "../../services/compliance-v3/suggestion.service";
import {
  analyzeSchema,
  approveSchema,
  analysisIdParamSchema,
  packIdParamSchema,
} from "./schemas";

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

export default router;
