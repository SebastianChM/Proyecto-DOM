/// <reference types="node" />
/**
 * Seed: NCh433 — Diseño Sísmico de Edificios (Chile, 2009)
 * Creates RegulationPack CL-NCH433-2009 with 12 verified requirements.
 *
 * Usage: npx tsx packages/database/prisma/cl-nch433-pack.ts
 *
 * Idempotent: safe to run multiple times. The pack is upserted by unique code.
 * Each requirement is checked for existence by code before inserting.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureMissingEntries() {
  // ReinforcementYieldStrength — yield stress of steel reinforcement (fy)
  for (const loc of [
    {
      locale: "en-US",
      displayName: "Reinforcement Yield Strength",
      aliases: ["fy", "Yield Strength", "Steel fy"],
    },
    {
      locale: "es-CL",
      displayName: "Resistencia de Fluencia del Acero",
      aliases: ["fy", "Fluencia Acero", "Resistencia Fluencia"],
    },
  ]) {
    await prisma.propertyDictionary.upsert({
      where: {
        canonicalName_locale: {
          canonicalName: "ReinforcementYieldStrength",
          locale: loc.locale,
        },
      },
      update: {
        displayName: loc.displayName,
        aliases: loc.aliases,
        unit: "MPa",
        dataType: "NUMBER",
      },
      create: {
        canonicalName: "ReinforcementYieldStrength",
        locale: loc.locale,
        displayName: loc.displayName,
        aliases: loc.aliases,
        unit: "MPa",
        dataType: "NUMBER",
      },
    });
  }

  // SlendernessRatio — ratio of effective length to radius of gyration (h/b for columns)
  for (const loc of [
    {
      locale: "en-US",
      displayName: "Slenderness Ratio",
      aliases: ["h/b Ratio", "Column Slenderness"],
    },
    {
      locale: "es-CL",
      displayName: "Relación de Esbeltez",
      aliases: ["Esbeltez", "Relacion Esbeltez", "h/b"],
    },
  ]) {
    await prisma.propertyDictionary.upsert({
      where: {
        canonicalName_locale: {
          canonicalName: "SlendernessRatio",
          locale: loc.locale,
        },
      },
      update: {
        displayName: loc.displayName,
        aliases: loc.aliases,
        dataType: "NUMBER",
      },
      create: {
        canonicalName: "SlendernessRatio",
        locale: loc.locale,
        displayName: loc.displayName,
        aliases: loc.aliases,
        dataType: "NUMBER",
      },
    });
  }
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
    code: "CL-NCH433-R001",
    description:
      "El hormigón estructural debe tener una resistencia mínima a la compresión f'c = 25 MPa",
    legalReference: "NCh433 Art. 8.2.1",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["hormigon", "resistencia", "compresion", "sismico"],
    conditions: [
      {
        propertyRef: "ConcreteStrength",
        operator: ">=",
        value: "25",
        unit: "MPa",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: [
        "Structural Columns",
        "Structural Beams",
        "Structural Foundations",
      ],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R002",
    description:
      "El acero de refuerzo en elementos sísmicos debe tener una resistencia de fluencia mínima fy = 420 MPa",
    legalReference: "NCh433 Art. 8.3.2",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["acero", "refuerzo", "fluencia", "sismico"],
    conditions: [
      {
        propertyRef: "ReinforcementYieldStrength",
        operator: ">=",
        value: "420",
        unit: "MPa",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Rebar"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R003",
    description:
      "La relación esbeltez altura/dimensión mínima de columnas sísmicas no debe exceder 12",
    legalReference: "NCh433 Art. 9.4.1",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["columnas", "esbeltez", "sismico", "pandeo"],
    conditions: [
      {
        propertyRef: "SlendernessRatio",
        operator: "<=",
        value: "12",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Columns"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R004",
    description:
      "El recubrimiento de hormigón sobre el acero de refuerzo en fundaciones debe ser mínimo 70 mm",
    legalReference: "NCh433 Art. 8.4.1",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["fundaciones", "recubrimiento", "hormigon", "durabilidad"],
    conditions: [
      {
        propertyRef: "RebarCover",
        operator: ">=",
        value: "70",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Foundations"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R005",
    description:
      "El recubrimiento de hormigón sobre el acero de refuerzo en columnas y vigas debe ser mínimo 40 mm en zona sísmica",
    legalReference: "NCh433 Art. 8.4.2",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["columnas", "vigas", "recubrimiento", "zona-sismica"],
    conditions: [
      {
        propertyRef: "RebarCover",
        operator: ">=",
        value: "40",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Columns", "Structural Beams"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R006",
    description:
      "El espaciamiento máximo de barras de refuerzo transversal en columnas sísmicas es de 200 mm",
    legalReference: "NCh433 Art. 9.4.3",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["columnas", "estribos", "espaciamiento", "ductilidad"],
    conditions: [
      {
        propertyRef: "RebarSpacing",
        operator: "<=",
        value: "200",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Columns"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R007",
    description:
      "Los muros estructurales de hormigón armado en zona sísmica deben tener un espesor mínimo de 200 mm",
    legalReference: "NCh433 Art. 9.5.2",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["muros", "hormigon", "espesor", "sismico"],
    conditions: [
      {
        propertyRef: "Thickness",
        operator: ">=",
        value: "200",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Walls"],
      propertyFilters: { LoadBearing: "true" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R008",
    description:
      "El hormigón estructural en zonas sísmicas de alta amenaza (Zona 3) debe tener f'c mínimo de 30 MPa",
    legalReference: "NCh433 Art. 8.2.3",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["hormigon", "zona-3", "alta-amenaza", "resistencia"],
    notes:
      "Aplica a edificios en zonas sísmicas 2 y 3 según zonificación sísmica vigente.",
    conditions: [
      {
        propertyRef: "ConcreteStrength",
        operator: ">=",
        value: "30",
        unit: "MPa",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Columns", "Walls"],
      propertyFilters: { SeismicZone: "3" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R009",
    description:
      "El diámetro mínimo de barras longitudinales en elementos estructurales sísmicos es de 12 mm",
    legalReference: "NCh433 Art. 9.3.1",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["barras", "diametro", "longitudinal", "sismico"],
    conditions: [
      {
        propertyRef: "RebarDiameter",
        operator: ">=",
        value: "12",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Rebar"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R010",
    description:
      "El espaciamiento de estribos en zona de confinamiento de columnas no debe exceder 150 mm",
    legalReference: "NCh433 Art. 9.4.4",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["estribos", "confinamiento", "columnas", "ductilidad"],
    conditions: [
      {
        propertyRef: "Spacing",
        operator: "<=",
        value: "150",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Columns"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R011",
    description:
      "El ancho mínimo de vigas en marcos sísmicos ductiles debe ser de 300 mm",
    legalReference: "NCh433 Art. 9.3.2",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["vigas", "ancho", "marcos", "ductilidad"],
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=",
        value: "300",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Beams"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-NCH433-R012",
    description:
      "La profundidad mínima de vigas principales en marcos sísmicos debe ser de 400 mm",
    legalReference: "NCh433 Art. 9.3.3",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["vigas", "profundidad", "marcos", "sismico"],
    conditions: [
      {
        propertyRef: "Depth",
        operator: ">=",
        value: "400",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Structural Beams"],
      scope: "FILTERED",
    },
  },
];

async function main() {
  console.info("[SEED:NCH433] Starting seed for CL-NCH433-2009...");

  await ensureMissingEntries();
  console.info("[SEED:NCH433] Missing dictionary entries ensured.");

  const pack = await prisma.regulationPack.upsert({
    where: { code: "CL-NCH433-2009" },
    update: {},
    create: {
      code: "CL-NCH433-2009",
      name: "NCh433 — Diseño Sísmico de Edificios",
      description:
        "Requisitos de la norma NCh433 Of. 96 Modificada 2009 para diseño sísmico de edificios en Chile. " +
        "Aplica a estructuras en zonas sísmicas según la zonificación vigente.",
      country: "CL",
      version: "2009",
      status: "PUBLISHED",
      scope: ["STRUCTURAL"],
      publishedAt: new Date("2009-01-01"),
    },
  });

  console.info(`[SEED:NCH433] Pack upserted: ${pack.code}`);

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
    `[SEED:NCH433] Requirements: ${created} created, ${skipped} skipped (already exist).`,
  );
  console.info("[SEED:NCH433] Done.");
}

main()
  .catch((error) => {
    console.error("[SEED:NCH433] Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
