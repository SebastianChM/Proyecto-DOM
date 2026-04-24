import { Router } from "express";
import { basicAuth } from "../../middleware/auth";
import packsRouter from "./packs.routes";
import requirementsRouter from "./requirements.routes";
import configRouter from "./config.routes";
import runsRouter from "./runs.routes";

const router = Router();

// All compliance-v3 routes require authentication
router.use(basicAuth);

router.use("/packs", packsRouter);
router.use(requirementsRouter);
router.use(configRouter);
router.use(runsRouter);

export const complianceV3Router = router;
