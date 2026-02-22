/**
 * APS Derivatives Router
 * Handles interactions with Model Derivative API
 *
 * - Get Manifest
 * - Download Derivatives (SVF, PDF, etc)
 */

import { Router } from "express";
import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import { handleApsError } from "../../lib/utils";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * GET /api/aps/manifest/:urn
 * Get manifest for a URN (public endpoint for debugging)
 */
router.get("/manifest/:urn", async (req, res) => {
  try {
    const { urn } = req.params;
    logger.debug(`[APS_DERIVATIVES] Getting manifest for URN: ${urn}`);
    const manifest = await modelDerivativeService.getManifest(urn);
    res.json(manifest);
  } catch (error) {
    handleApsError(error, req, res);
  }
});

/**
 * GET /api/aps/derivative/:urn/:derivativeUrn
 * Download a specific derivative
 */
router.get("/derivative/:urn/:derivativeUrn", async (req, res) => {
  try {
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
  } catch (error) {
    handleApsError(error, req, res);
  }
});

export default router;
