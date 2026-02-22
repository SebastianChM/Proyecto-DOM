/**
 * File Routes - Main Router
 *
 * This module combines all file-related routes into a single router.
 *
 * Structure:
 * - /upload, /import-aps → upload.routes.ts
 * - /:id/download, /batch-download → download.routes.ts
 * - /sync-status → sync.routes.ts
 * - /:id/bom → bom.routes.ts
 * - /recent, /project/:id, /:id, /:id/versions → crud.routes.ts
 */

import { Router } from "express";
import uploadRoutes from "./upload.routes";
import downloadRoutes from "./download.routes";
import syncRoutes from "./sync.routes";
import bomRoutes from "./bom.routes";
import crudRoutes from "./crud.routes";

const router = Router();

// Mount sub-routers
router.use(uploadRoutes);
router.use(downloadRoutes);
router.use(syncRoutes);
router.use(bomRoutes);
router.use(crudRoutes);

export default router;
