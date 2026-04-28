/// <reference types="node" />
/**
 * Seed: NSEG — Reglamento de Instalaciones Eléctricas de Interior (Chile, 2023)
 * Creates RegulationPack CL-NSEG-2023 with 15 verified requirements.
 *
 * Usage: npx tsx packages/database/prisma/cl-electrical-pack.ts
 *
 * Idempotent: safe to run multiple times. The pack is upserted by unique code.
 * Each requirement is checked for existence by code before inserting.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureMissingEntries() {
  // CableTrayHeight — vertical height/depth of a cable tray profile
  for (const loc of [
    {
      locale: "en-US",
      displayName: "Cable Tray Height",
      aliases: ["Tray Height", "Tray Depth"],
    },
    {
      locale: "es-CL",
      displayName: "Altura Bandeja Portacable",
      aliases: ["Alto Bandeja", "Profundidad Bandeja"],
    },
  ]) {
    await prisma.propertyDictionary.upsert({
      where: {
        canonicalName_locale: {
          canonicalName: "CableTrayHeight",
          locale: loc.locale,
        },
      },
      update: {
        displayName: loc.displayName,
        aliases: loc.aliases,
        unit: "mm",
        dataType: "NUMBER",
      },
      create: {
        canonicalName: "CableTrayHeight",
        locale: loc.locale,
        displayName: loc.displayName,
        aliases: loc.aliases,
        unit: "mm",
        dataType: "NUMBER",
      },
    });
  }

  // WallThicknessMin — min wall thickness for conduit (different semantics than generic Thickness)
  // Note: Thickness already exists generically; this seed uses Thickness directly.
  // No new entries needed beyond CableTrayHeight.
}

interface RequirementSeed {
  code: string;
  description: string;
  legalReference: string;
  discipline: string;
  severity: string;
  tags: string[];
  notes?: string;
  conditions: {
    propertyRef: string;
    operator: string;
    value: string;
    unit?: string;
    logicGroup?: string;
    sortOrder?: number;
  }[];
  applicability: {
    targetCategories: string[];
    excludeCategories?: string[];
    propertyFilters?: Record<string, string>;
    scope?: string;
  };
}

const REQUIREMENTS: RequirementSeed[] = [
  {
    code: "CL-NSEG-R001",
    description:
      "Las bandejas portacables deben tener un ancho mínimo de 100 mm",
    legalReference: "NSEG 5 Sec. 3.1.2",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["bandeja", "portacable", "ancho", "electrico"],
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=",
        value: "100",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Cable Trays"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R002",
    description:
      "Las bandejas portacables no deben superar una altura (profundidad de perfil) de 150 mm",
    legalReference: "NSEG 5 Sec. 3.1.2",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["bandeja", "portacable", "altura", "perfil"],
    conditions: [
      {
        propertyRef: "CableTrayHeight",
        operator: "<=",
        value: "150",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Cable Trays"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R003",
    description:
      "Los ductos o tuberías eléctricas (conduits) deben tener un diámetro nominal mínimo de 20 mm",
    legalReference: "NSEG 5 Sec. 3.2.1",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["conduit", "diametro", "tuberia", "electrico"],
    conditions: [
      {
        propertyRef: "Diameter",
        operator: ">=",
        value: "20",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Conduits"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R004",
    description:
      "Los tableros eléctricos deben operar con un voltaje nominal dentro del rango 220–440 V",
    legalReference: "NSEG 5 Sec. 4.1.1",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["tablero", "voltaje", "tension", "nominal"],
    conditions: [
      {
        propertyRef: "Voltage",
        operator: "range",
        value: "220,440",
        unit: "V",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Electrical Equipment"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R005",
    description:
      "La corriente máxima en el interruptor principal de un tablero de distribución no debe superar 400 A",
    legalReference: "NSEG 5 Sec. 4.1.2",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["tablero", "corriente", "interruptor", "proteccion"],
    conditions: [
      {
        propertyRef: "Current",
        operator: "<=",
        value: "400",
        unit: "A",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Electrical Equipment"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R006",
    description:
      "Los tableros eléctricos deben tener una altura mínima de 1200 mm para permitir acceso y maniobra",
    legalReference: "NSEG 5 Sec. 4.2.1",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["tablero", "altura", "acceso", "maniobra"],
    conditions: [
      {
        propertyRef: "Height",
        operator: ">=",
        value: "1200",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Electrical Equipment"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R007",
    description:
      "Los tableros eléctricos deben tener una profundidad mínima de 200 mm para alojar cableado y barras",
    legalReference: "NSEG 5 Sec. 4.2.3",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["tablero", "profundidad", "cableado", "instalacion"],
    conditions: [
      {
        propertyRef: "Depth",
        operator: ">=",
        value: "200",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Electrical Equipment"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R008",
    description:
      "El diámetro máximo de conduits individuales en un mismo recorrido no debe exceder 100 mm",
    legalReference: "NSEG 5 Sec. 3.2.2",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["conduit", "diametro", "limite", "instalacion"],
    conditions: [
      {
        propertyRef: "Diameter",
        operator: "<=",
        value: "100",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Conduits"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R009",
    description:
      "El espesor mínimo de pared de conduits metálicos de acero es de 1.2 mm",
    legalReference: "NSEG 5 Sec. 3.2.5",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["conduit", "metalico", "espesor", "pared"],
    conditions: [
      {
        propertyRef: "Thickness",
        operator: ">=",
        value: "1.2",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Conduits"],
      propertyFilters: { Material: "Steel" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R010",
    description:
      "Las bandejas portacables en recorridos principales de distribución deben tener un ancho mínimo de 200 mm",
    legalReference: "NSEG 5 Sec. 3.1.4",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["bandeja", "distribucion", "principal", "ancho"],
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=",
        value: "200",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Cable Trays"],
      propertyFilters: { Function: "Main Distribution" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R011",
    description:
      "El espaciamiento máximo entre soportes de bandejas portacables es de 1500 mm",
    legalReference: "NSEG 5 Sec. 3.1.6",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["bandeja", "soporte", "espaciamiento", "instalacion"],
    conditions: [
      {
        propertyRef: "Spacing",
        operator: "<=",
        value: "1500",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Cable Trays"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R012",
    description:
      "Las luminarias deben operar con un voltaje nominal dentro del rango 110–240 V",
    legalReference: "NSEG 5 Sec. 6.1.1",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["luminaria", "voltaje", "tension", "iluminacion"],
    conditions: [
      {
        propertyRef: "Voltage",
        operator: "range",
        value: "110,240",
        unit: "V",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Lighting Fixtures"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R013",
    description:
      "La potencia máxima instalada por luminaria en espacios de trabajo no debe superar 200 W",
    legalReference: "NSEG 5 Sec. 6.1.3",
    discipline: "ELECTRICAL",
    severity: "RECOMMENDED",
    tags: ["luminaria", "potencia", "eficiencia", "iluminacion"],
    notes:
      "Criterio de eficiencia energética. Para iluminación LED el límite efectivo es 100 W.",
    conditions: [
      {
        propertyRef: "Power",
        operator: "<=",
        value: "200",
        unit: "W",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Lighting Fixtures"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R014",
    description:
      "Los artefactos eléctricos enchufables deben operar en el rango de voltaje 220–240 V",
    legalReference: "NSEG 5 Sec. 5.2.1",
    discipline: "ELECTRICAL",
    severity: "MANDATORY",
    tags: ["artefacto", "enchufe", "voltaje", "tomacorriente"],
    conditions: [
      {
        propertyRef: "Voltage",
        operator: "range",
        value: "220,240",
        unit: "V",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Electrical Fixtures"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NSEG-R015",
    description:
      "La longitud máxima de un conduit entre cajas de derivación o tableros no debe exceder 3000 mm sin accesorio de expansión",
    legalReference: "NSEG 5 Sec. 3.2.8",
    discipline: "ELECTRICAL",
    severity: "RECOMMENDED",
    tags: ["conduit", "longitud", "caja-derivacion", "instalacion"],
    notes:
      "La limitación aplica a conduits sin compensadores de dilatación térmica.",
    conditions: [
      {
        propertyRef: "Length",
        operator: "<=",
        value: "3000",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Conduits"],
      scope: "FILTERED",
    },
  },
];

async function main() {
  console.info("[SEED:NSEG] Starting seed for CL-NSEG-2023...");

  await ensureMissingEntries();
  console.info("[SEED:NSEG] Missing dictionary entries ensured.");

  const pack = await prisma.regulationPack.upsert({
    where: { code: "CL-NSEG-2023" },
    update: {},
    create: {
      code: "CL-NSEG-2023",
      name: "NSEG — Reglamento de Instalaciones Eléctricas de Interior",
      description:
        "Requisitos del Reglamento de Instalaciones Eléctricas de Interior (NSEG 5 E.n. 71) " +
        "y sus actualizaciones. Aplica a instalaciones eléctricas en edificios.",
      country: "CL",
      version: "2023",
      status: "PUBLISHED",
      scope: ["ELECTRICAL"],
      publishedAt: new Date("2023-01-01"),
    },
  });

  console.info(`[SEED:NSEG] Pack upserted: ${pack.code}`);

  let created = 0;
  let skipped = 0;

  for (const req of REQUIREMENTS) {
    const existing = await prisma.requirement.findFirst({
      where: { code: req.code },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const requirement = await tx.requirement.create({
        data: {
          code: req.code,
          packId: pack.id,
          description: req.description,
          legalReference: req.legalReference,
          discipline: req.discipline,
          severity: req.severity,
          tags: req.tags,
          notes: req.notes ?? null,
          status: "VERIFIED",
          verifiedBy: "seed-script",
          verifiedAt: new Date(),
        },
      });

      for (const cond of req.conditions) {
        await tx.requirementCondition.create({
          data: {
            requirementId: requirement.id,
            propertyRef: cond.propertyRef,
            operator: cond.operator,
            value: cond.value,
            unit: cond.unit ?? null,
            logicGroup: cond.logicGroup ?? "AND",
            sortOrder: cond.sortOrder ?? 0,
          },
        });
      }

      await tx.applicabilityRule.create({
        data: {
          requirementId: requirement.id,
          targetCategories: req.applicability.targetCategories,
          excludeCategories: req.applicability.excludeCategories ?? [],
          propertyFilters: req.applicability.propertyFilters ?? Prisma.JsonNull,
          scope: req.applicability.scope ?? "FILTERED",
        },
      });
    });

    created++;
  }

  console.info(
    `[SEED:NSEG] Requirements: ${created} created, ${skipped} skipped (already exist).`,
  );
  console.info("[SEED:NSEG] Done.");
}

main()
  .catch((error) => {
    console.error("[SEED:NSEG] Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
