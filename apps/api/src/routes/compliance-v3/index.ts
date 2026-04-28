import { Router } from "express";
import { basicAuth } from "../../middleware/auth";
import packsRouter from "./packs.routes";
import requirementsRouter from "./requirements.routes";
import configRouter from "./config.routes";
import runsRouter from "./runs.routes";
import suggestionsRouter from "./suggestions.routes";
import dictionariesRouter from "./dictionaries.routes";
import idsRouter from "./ids.routes";

const router = Router();

router.use(basicAuth);

router.use("/packs", packsRouter);
router.use("/packs", idsRouter);
router.use(requirementsRouter);
router.use(configRouter);
router.use(runsRouter);
router.use(suggestionsRouter);
router.use("/dictionaries", dictionariesRouter);

export const complianceV3Router = router;
