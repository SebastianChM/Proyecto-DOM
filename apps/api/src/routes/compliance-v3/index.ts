import { Router } from "express";
import packsRouter from "./packs.routes";
import requirementsRouter from "./requirements.routes";

const router = Router();

router.use("/packs", packsRouter);
router.use(requirementsRouter);

export const complianceV3Router = router;
