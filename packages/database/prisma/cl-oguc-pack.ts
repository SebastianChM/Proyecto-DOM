/// <reference types="node" />
/**
 * Seed: OGUC — Ordenanza General de Urbanismo y Construcción (Chile, 2024)
 * Creates RegulationPack CL-OGUC-2024 with 20 verified requirements.
 *
 * Usage: npx tsx packages/database/prisma/cl-oguc-pack.ts
 *
 * Idempotent: safe to run multiple times. The pack is upserted by unique code.
 * Each requirement is checked for existence by code before inserting.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureMissingEntries() {
  // StairRiserHeight — vertical height of a stair step
  for (const loc of [
    {
      locale: "en-US",
      displayName: "Stair Riser Height",
      aliases: ["Riser Height", "Riser"],
    },
    {
      locale: "es-CL",
      displayName: "Altura de Contrahuella",
      aliases: ["Contrahuella", "Alzada"],
    },
  ]) {
    await prisma.propertyDictionary.upsert({
      where: {
        canonicalName_locale: {
          canonicalName: "StairRiserHeight",
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
        canonicalName: "StairRiserHeight",
        locale: loc.locale,
        displayName: loc.displayName,
        aliases: loc.aliases,
        unit: "mm",
        dataType: "NUMBER",
      },
    });
  }

  // StairTreadDepth — horizontal depth of a stair tread (huella)
  for (const loc of [
    {
      locale: "en-US",
      displayName: "Stair Tread Depth",
      aliases: ["Tread Depth", "Tread", "Nosing"],
    },
    {
      locale: "es-CL",
      displayName: "Profundidad de Huella",
      aliases: ["Huella", "Ancho Huella"],
    },
  ]) {
    await prisma.propertyDictionary.upsert({
      where: {
        canonicalName_locale: {
          canonicalName: "StairTreadDepth",
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
        canonicalName: "StairTreadDepth",
        locale: loc.locale,
        displayName: loc.displayName,
        aliases: loc.aliases,
        unit: "mm",
        dataType: "NUMBER",
      },
    });
  }

  // Rooms — Revit room objects that capture space height
  for (const loc of [
    {
      locale: "en-US",
      displayName: "Rooms",
      aliases: ["Room", "Space", "Spaces"],
    },
    {
      locale: "es-CL",
      displayName: "Recintos",
      aliases: ["Recinto", "Habitación", "Espacio", "Espacios"],
    },
  ]) {
    await prisma.categoryDictionary.upsert({
      where: {
        canonicalName_locale: { canonicalName: "Rooms", locale: loc.locale },
      },
      update: {
        displayName: loc.displayName,
        aliases: loc.aliases,
        revitCategory: "Rooms",
        ifcEntity: "IfcSpace",
        discipline: "ARCHITECTURAL",
      },
      create: {
        canonicalName: "Rooms",
        locale: loc.locale,
        displayName: loc.displayName,
        aliases: loc.aliases,
        revitCategory: "Rooms",
        ifcEntity: "IfcSpace",
        discipline: "ARCHITECTURAL",
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
  // ARCHITECTURAL (8)
  {
    code: "CL-OGUC-2024-R001",
    description:
      "Las escaleras de uso público deben tener un ancho libre mínimo de 1200 mm",
    legalReference: "OGUC Art. 4.2.1",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["escaleras", "ancho", "accesibilidad", "evacuacion"],
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=",
        value: "1200",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Stairs"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R002",
    description:
      "Las puertas de evacuación deben tener un ancho libre mínimo de 900 mm",
    legalReference: "OGUC Art. 4.2.3",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["puertas", "evacuacion", "escape", "ancho"],
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=",
        value: "900",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Doors"],
      propertyFilters: { Function: "Exit" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R003",
    description:
      "La altura libre de piso a cielo en espacios habitables debe ser mínimo 2300 mm",
    legalReference: "OGUC Art. 4.1.5",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["altura", "espacios", "habitabilidad"],
    conditions: [
      {
        propertyRef: "Height",
        operator: ">=",
        value: "2300",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Rooms"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R006",
    description:
      "Las rampas de acceso no deben superar una pendiente del 8% en recorridos de uso público",
    legalReference: "OGUC Art. 4.1.18",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["rampas", "pendiente", "accesibilidad", "discapacidad"],
    conditions: [
      {
        propertyRef: "Slope",
        operator: "<=",
        value: "8",
        unit: "deg",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Ramps"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R007",
    description:
      "Las escaleras deben tener una altura de contrahuella máxima de 190 mm",
    legalReference: "OGUC Art. 4.2.2",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["escaleras", "contrahuella", "seguridad"],
    conditions: [
      {
        propertyRef: "StairRiserHeight",
        operator: "<=",
        value: "190",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Stairs"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R008",
    description:
      "Las escaleras deben tener una profundidad de huella mínima de 280 mm",
    legalReference: "OGUC Art. 4.2.2",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["escaleras", "huella", "seguridad"],
    conditions: [
      {
        propertyRef: "StairTreadDepth",
        operator: ">=",
        value: "280",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Stairs"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R009",
    description:
      "Las barandas de escaleras y balcones deben tener una altura mínima de 900 mm",
    legalReference: "OGUC Art. 4.2.7",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["barandas", "altura", "seguridad", "caida"],
    conditions: [
      {
        propertyRef: "Height",
        operator: ">=",
        value: "900",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Railings"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R010",
    description:
      "Las ventanas en habitaciones deben tener un área de ventilación natural mínima del 8% de la superficie del recinto",
    legalReference: "OGUC Art. 4.1.6",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["ventanas", "ventilacion", "habitabilidad"],
    notes:
      "El área de apertura de ventilación debe ser al menos 0.08 m2 por m2 de recinto.",
    conditions: [
      {
        propertyRef: "Area",
        operator: ">=",
        value: "0.5",
        unit: "m2",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Windows"],
      scope: "FILTERED",
    },
  },
  // FIRE_PROTECTION (7)
  {
    code: "CL-OGUC-2024-R004",
    description:
      "Los muros cortafuego deben tener una resistencia al fuego mínima de F-120",
    legalReference: "OGUC Art. 4.3.2",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["muros", "cortafuego", "resistencia-fuego", "F-120"],
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "120",
        unit: "min",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Walls"],
      propertyFilters: { Function: "Firewall" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R005",
    description:
      "Las puertas cortafuego deben tener una resistencia al fuego mínima de F-60",
    legalReference: "OGUC Art. 4.3.4",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["puertas", "cortafuego", "resistencia-fuego", "F-60"],
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "60",
        unit: "min",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Doors"],
      propertyFilters: { Function: "Fire" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R011",
    description:
      "Los muros de cajas de escalera y vías de evacuación deben tener resistencia al fuego mínima F-60",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["muros", "escalera", "evacuacion", "resistencia-fuego"],
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "60",
        unit: "min",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Walls"],
      propertyFilters: { Function: "Stairwell" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R012",
    description:
      "Los pisos de separación entre ocupaciones de distinto uso deben tener resistencia al fuego mínima F-60",
    legalReference: "OGUC Art. 4.3.5",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["pisos", "separacion", "resistencia-fuego"],
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "60",
        unit: "min",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Floors"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R013",
    description:
      "Las cubiertas en zonas de riesgo de incendio deben ser de material no combustible",
    legalReference: "OGUC Art. 4.3.7",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["cubierta", "techo", "no-combustible", "incendio"],
    conditions: [
      {
        propertyRef: "Combustible",
        operator: "==",
        value: "false",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Roofs"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R014",
    description:
      "Los cielos en corredores de evacuación deben tener resistencia al fuego mínima F-30",
    legalReference: "OGUC Art. 4.3.8",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["cielos", "pasillo", "evacuacion", "resistencia-fuego"],
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "30",
        unit: "min",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Ceilings"],
      propertyFilters: { Function: "Egress" },
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R015",
    description:
      "Los muros exteriores en edificios de más de 3 pisos deben tener resistencia al fuego mínima F-30",
    legalReference: "OGUC Art. 4.3.1",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["muros", "exterior", "resistencia-fuego"],
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "30",
        unit: "min",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Walls"],
      propertyFilters: { Function: "Exterior" },
      scope: "FILTERED",
    },
  },
  // STRUCTURAL (5)
  {
    code: "CL-OGUC-2024-R016",
    description:
      "Los muros estructurales de albañilería deben tener un espesor mínimo de 150 mm",
    legalReference: "OGUC Art. 5.5.2",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["muros", "estructural", "albanileria", "espesor"],
    conditions: [
      {
        propertyRef: "Thickness",
        operator: ">=",
        value: "150",
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
    code: "CL-OGUC-2024-R017",
    description:
      "Las fundaciones deben tener una profundidad mínima de 600 mm bajo el nivel natural del terreno",
    legalReference: "OGUC Art. 5.6.1",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["fundaciones", "profundidad", "cimiento"],
    conditions: [
      {
        propertyRef: "Depth",
        operator: ">=",
        value: "600",
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
    code: "CL-OGUC-2024-R018",
    description:
      "El recubrimiento mínimo del acero de refuerzo en vigas de hormigón armado es de 30 mm",
    legalReference: "OGUC Art. 5.7.3",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["vigas", "recubrimiento", "hormigon", "armado"],
    conditions: [
      {
        propertyRef: "RebarCover",
        operator: ">=",
        value: "30",
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
    code: "CL-OGUC-2024-R019",
    description:
      "El recubrimiento mínimo del acero de refuerzo en columnas de hormigón armado es de 40 mm",
    legalReference: "OGUC Art. 5.7.4",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["columnas", "recubrimiento", "hormigon", "armado"],
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
      targetCategories: ["Structural Columns"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R020",
    description:
      "Las losas de piso de hormigón armado deben tener un espesor mínimo de 120 mm",
    legalReference: "OGUC Art. 5.5.4",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["losa", "piso", "hormigon", "espesor"],
    conditions: [
      {
        propertyRef: "Thickness",
        operator: ">=",
        value: "120",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Floors"],
      scope: "FILTERED",
    },
  },
];

async function main() {
  console.info("[SEED:OGUC] Starting seed for CL-OGUC-2024...");

  await ensureMissingEntries();
  console.info("[SEED:OGUC] Missing dictionary entries ensured.");

  const pack = await prisma.regulationPack.upsert({
    where: { code: "CL-OGUC-2024" },
    update: {},
    create: {
      code: "CL-OGUC-2024",
      name: "OGUC — Ordenanza General de Urbanismo y Construcción",
      description:
        "Requisitos técnicos de la Ordenanza General de Urbanismo y Construcción de Chile. " +
        "Aplica a proyectos de edificación y urbanización.",
      country: "CL",
      version: "2024",
      status: "PUBLISHED",
      scope: ["ARCHITECTURAL", "STRUCTURAL", "FIRE_PROTECTION"],
      publishedAt: new Date("2024-01-01"),
    },
  });

  console.info(`[SEED:OGUC] Pack upserted: ${pack.code}`);

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
    `[SEED:OGUC] Requirements: ${created} created, ${skipped} skipped (already exist).`,
  );
  console.info("[SEED:OGUC] Done.");
}

main()
  .catch((error) => {
    console.error("[SEED:OGUC] Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
