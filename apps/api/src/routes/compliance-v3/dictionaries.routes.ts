import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { propertyDictionaryService } from "../../services/dictionary/property-dictionary.service";
import { categoryDictionaryService } from "../../services/dictionary/category-dictionary.service";
import { unitConversionService } from "../../services/dictionary/unit-conversion.service";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";

const router = Router();

router.get(
  "/properties",
  asyncHandler(async (req, res) => {
    const locale = (req.query.locale as string) || env.DEFAULT_LOCALE;
    const data = await propertyDictionaryService.getAll(locale);
    logger.info("[dictionaries] GET /properties", {
      count: data.length,
      locale,
    });
    res.json(data);
  }),
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const locale = (req.query.locale as string) || env.DEFAULT_LOCALE;
    const data = await categoryDictionaryService.getAll(locale);
    logger.info("[dictionaries] GET /categories", {
      count: data.length,
      locale,
    });
    res.json(data);
  }),
);

router.get(
  "/units",
  asyncHandler(async (req, res) => {
    const data = await unitConversionService.getAll();
    logger.info("[dictionaries] GET /units", { count: data.length });
    res.json(data);
  }),
);

export default router;
