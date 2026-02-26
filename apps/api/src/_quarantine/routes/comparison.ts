import { Router } from "express";
import { apsComparisonService } from "../services/aps/comparison.service";

const router = Router();

// GET /api/comparison/:baseUrn/:targetUrn
router.get("/:baseUrn/:targetUrn", async (req, res, next) => {
  try {
    // TODO: Validate user has access to both URNs via project membership
    const { baseUrn, targetUrn } = req.params;

    if (!baseUrn || !targetUrn) {
      res.status(400).json({ error: "Missing baseUrn or targetUrn" });
      return;
    }

    const result = await apsComparisonService.compareMetadata(
      baseUrn,
      targetUrn,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
