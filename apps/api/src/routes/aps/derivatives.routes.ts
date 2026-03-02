/**
 * APS Derivatives Router
 * Handles interactions with Model Derivative API
 *
 * - Get Manifest
 * - Download Derivatives (SVF, PDF, etc)
 */

import { Router } from "express";
import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import { asyncHandler } from "../../lib/async-handler";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * GET /api/aps/manifest/:urn
 * Get manifest for a URN (public endpoint for debugging)
 */
router.get("/manifest/:urn", asyncHandler(async (req, res) => {
    const { urn } = req.params;
    logger.debug(`[APS_DERIVATIVES] Getting manifest for URN: ${urn}`);
    const manifest = await modelDerivativeService.getManifest(urn);
    res.json(manifest);
}));

/**
 * GET /api/aps/derivative/:urn/:derivativeUrn
 * Download a specific derivative
 */
router.get("/derivative/:urn/:derivativeUrn", asyncHandler(async (req, res) => {
    const { urn, derivativeUrn } = req.params;
    const decodedDerivativeUrn = decodeURIComponent(derivativeUrn);

    logger.debug(
      `[APS_DERIVATIVES] Downloading derivative: ${decodedDerivativeUrn} from ${urn}`,
    );

    const buffer = await modelDerivativeService.getDerivative(
      urn,
      decodedDerivativeUrn,
    );

    // Try to infer filename from derivative URN or default to generic
    const filename = decodedDerivativeUrn.split("/").pop() || "derivative.pdf";

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
}));

export default router;
