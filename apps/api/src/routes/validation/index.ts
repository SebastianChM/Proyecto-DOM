/**
 * Validation Routes - Main Router
 *
 * Modularized validation logic consolidating:
 * - validation.ts (legacy upload/sync logic)
 * - validations.ts (CRUD logic)
 * - validation-runner.ts (Queue logic)
 */

import { Router } from "express";
import crudRoutes from "./crud.routes";
import uploadRoutes from "./upload.routes";
import runnerRoutes from "./runner.routes";

const router = Router();

// Mount sub-routers
router.use(uploadRoutes); // /upload-et
router.use(runnerRoutes); // /run, /validate
router.use(crudRoutes); // /, /:id, /stats, etc.

export default router;
