/**
 * Compliance Routes Index
 *
 * Exposes V1 (Legacy) and V2 (Rules, Runs, Export) routers.
 */

import { Router } from "express";
import v1Routes from "./v1.routes";
import rulesRoutes from "./rules.routes";
import runsRoutes from "./runs.routes";
import exportRoutes from "./export.routes";

// V1 Router (Legacy) -> /api/compliance
export const v1Router = v1Routes;

// V2 Routers (Modular)
export const v2RulesRouter = rulesRoutes; // -> /api/compliance-v2
export const v2RunsRouter = runsRoutes; // -> /api/compliance-v2/runs
export const v2ExportRouter = exportRoutes; // -> /api/compliance-v2/export

// Unified V2 Router (Optional alternative)
// -> /api/compliance/v2
const v2Unified = Router();
v2Unified.use("/", rulesRoutes);
v2Unified.use("/runs", runsRoutes);
v2Unified.use("/export", exportRoutes);

export const v2UnifiedRouter = v2Unified;
