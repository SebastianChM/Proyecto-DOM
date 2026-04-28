import { Router } from "express";
import rulesRoutes from "./rules.routes";
import runsRoutes from "./runs.routes";
import exportRoutes from "./export.routes";

export const v2RulesRouter = rulesRoutes;
export const v2RunsRouter = runsRoutes;
export const v2ExportRouter = exportRoutes;

const v2Unified = Router();
v2Unified.use("/", rulesRoutes);
v2Unified.use("/runs", runsRoutes);
v2Unified.use("/export", exportRoutes);

export const v2UnifiedRouter = v2Unified;
