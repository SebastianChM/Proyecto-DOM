/**
 * Design Automation Callback Routes
 *
 * Canonical callback path: /api/callbacks/design-automation/callback
 * Legacy APS webhook callback path delegates to the same enqueue logic.
 */

import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import {
  DesignAutomationCallbackError,
  enqueueDesignAutomationCallback,
  normalizeDesignAutomationCallbackPayload,
} from "../services/design-automation-callback.service";

const router = Router();

async function handleDesignAutomationCallbackRequest(
  req: Request,
  res: Response,
) {
  try {
    const callback = normalizeDesignAutomationCallbackPayload(req.body);

    logger.debug("[DA_CALLBACK] Received", {
      ...logger.fromReq(req),
      workItemId: `${callback.workItemId.substring(0, 30)}...`,
      status: callback.status,
      hasReportUrl: !!callback.reportUrl,
    });

    const result = await enqueueDesignAutomationCallback(
      callback,
      logger.fromReq(req),
    );

    if (result.duplicate) {
      return res.status(200).json({
        message: "Already processed (idempotent)",
        conversionId: result.conversionId,
      });
    }

    return res.status(202).json({
      accepted: true,
      conversionId: result.conversionId,
    });
  } catch (error) {
    if (error instanceof DesignAutomationCallbackError) {
      logger.warn("[DA_CALLBACK] Callback rejected", {
        ...logger.fromReq(req),
        code: error.code,
        message: error.message,
      });

      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    logger.error("[DA_CALLBACK] Error", {
      ...logger.fromReq(req),
      error:
        error instanceof Error ? error.message.substring(0, 200) : "Unknown",
    });

    return res.status(500).json({
      error: "Callback processing failed",
      code: "INTERNAL_ERROR",
    });
  }
}

router.post("/design-automation/callback", handleDesignAutomationCallbackRequest);

export { handleDesignAutomationCallbackRequest };
export default router;
