/**
 * APS Routes Index
 * Unified access to Autodesk Platform Services
 */

import { Router } from "express";
import hubsRouter from "./hubs.routes";
import derivativesRouter from "./derivatives.routes";

const router = Router();

router.use(hubsRouter);
router.use(derivativesRouter);

export default router;
