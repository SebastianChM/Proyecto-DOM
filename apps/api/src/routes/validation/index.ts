/**
 * Validation Routes - Main Router
 *
 * Canonical mount: /api/validation
 *
 * Modularized validation logic consolidating:
 * - crud.routes.ts (CRUD logic)
 * - upload.routes.ts (upload/sync logic)
 * - runner.routes.ts (Queue logic)
 */

import { Router } from "express";
import { basicAuth } from "../../middleware/auth";
import crudRoutes from "./crud.routes";
import uploadRoutes from "./upload.routes";
import runnerRoutes from "./runner.routes";

const router = Router();

router.use(basicAuth);

// Mount sub-routers
router.use(uploadRoutes); // /upload-et
router.use(runnerRoutes); // /run, /validate
router.use(crudRoutes); // /, /:id, /stats, etc.

export default router;
