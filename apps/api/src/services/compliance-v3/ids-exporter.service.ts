import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { notFound } from "../../lib/errors";

export interface IIdsExporterService {
  exportPackToIds(packId: string): Promise<string>;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class IdsExporterService implements IIdsExporterService {
  async exportPackToIds(packId: string): Promise<string> {
    const pack = await prisma.regulationPack.findUnique({
      where: { id: packId },
    });

    if (!pack) {
      throw notFound(`RegulationPack not found: ${packId}`, "PACK_NOT_FOUND");
    }

    const requirements = await prisma.requirement.findMany({
      where: { packId, status: "VERIFIED" },
      include: {
        conditions: { orderBy: { sortOrder: "asc" } },
        applicability: true,
      },
      take: 500,
      orderBy: { createdAt: "asc" },
    });

    logger.info("[IdsExporter] Exporting pack to IDS", {
      packId,
      requirementCount: requirements.length,
    });

    const specificationBlocks = requirements.map((req) => {
      const targetCategory =
        (req.applicability?.targetCategories?.[0] as string | undefined) ??
        "IFCPRODUCT";

      const propertyBlocks = req.conditions
        .map((condition) => {
          const valueBlock = condition.value
            ? `          <value>
            <xs:restriction base="xs:string">
              <xs:minInclusive value="${escapeXml(condition.value)}"/>
            </xs:restriction>
          </value>`
            : "";

          return `        <property dataType="IfcLabel">
          <propertySet><simpleValue>Custom_DOM BIM</simpleValue></propertySet>
          <baseName><simpleValue>${escapeXml(condition.propertyRef)}</simpleValue></baseName>
${valueBlock}
        </property>`;
        })
        .join("\n");

      return `    <specification name="${escapeXml(req.code)}" ifcVersion="IFC4" description="${escapeXml(req.description ?? "")}">
      <applicability>
        <entity>
          <name>
            <simpleValue>${escapeXml(targetCategory)}</simpleValue>
          </name>
        </entity>
      </applicability>
      <requirements>
${propertyBlocks}
      </requirements>
    </specification>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS"
     xmlns:xs="http://www.w3.org/2001/XMLSchema"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/0.9.7/ids.xsd">
  <specifications>
${specificationBlocks.join("\n")}
  </specifications>
</ids>`;

    return xml;
  }
}

export const idsExporterService: IIdsExporterService = new IdsExporterService();
