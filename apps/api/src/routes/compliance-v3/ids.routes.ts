import { Router, Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest } from "../../lib/errors";
import { idsParserService } from "../../services/compliance-v3/ids-parser.service";
import { idsExporterService } from "../../services/compliance-v3/ids-exporter.service";
import { requirementService } from "../../services/compliance-v3/requirement.service";
import { idsImportBodySchema, idsPackParamSchema } from "./schemas";

const router = Router({ mergeParams: true });

router.post(
  "/:packId/import/ids",
  asyncHandler(async (req: Request, res: Response) => {
    const { packId } = idsPackParamSchema.parse(req.params);
    const { discipline, xmlContent } = idsImportBodySchema.parse(req.body);

    const parseResult = idsParserService.parseXml(xmlContent);
    const inputs = idsParserService.convertToRequirementInputs(
      parseResult,
      packId,
      discipline,
    );

    if (inputs.length === 0) {
      throw badRequest(
        "No valid IDS specifications found",
        "IDS_NO_VALID_SPECS",
      );
    }

    const created = await requirementService.bulkCreate(packId, {
      requirements: inputs,
    });

    res.status(201).json({
      created: created.length,
      errors: parseResult.errors,
    });
  }),
);

router.get(
  "/:packId/export/ids",
  asyncHandler(async (req: Request, res: Response) => {
    const { packId } = idsPackParamSchema.parse(req.params);

    const xml = await idsExporterService.exportPackToIds(packId);

    const hasContent = xml.includes("<specification") && xml.trim().length > 0;

    if (!hasContent) {
      throw badRequest(
        "No verified requirements to export",
        "IDS_NO_VERIFIED_REQUIREMENTS",
      );
    }

    res.setHeader("Content-Type", "application/xml");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pack-${packId}.ids"`,
    );
    res.send(xml);
  }),
);

export default router;
