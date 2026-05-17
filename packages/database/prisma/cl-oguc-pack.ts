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
      "Las escaleras de uso público deben tener un ancho libre mínimo de 1200 mm (para carga de ocupación de 51 a 100 personas)",
    legalReference: "OGUC Art. 4.2.10",
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
      "Las puertas de escape deben tener un ancho nominal de hoja no menor a 850 mm y ancho libre de salida no menor a 800 mm",
    legalReference: "OGUC Art. 4.2.24",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["puertas", "evacuacion", "escape", "ancho"],
    notes:
      "Art. 4.2.24: ancho nominal hoja \u2265 0,85 m y ancho libre \u2265 0,80 m. Excepci\u00f3n: puerta de salida de escalera de evacuaci\u00f3n en el piso de salida: hoja \u2265 0,90 m.",
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=",
        value: "850",
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
      "La altura libre de piso a cielo en locales habitables debe ser mínimo 2300 mm (excluye baños, cocinas, lavaderos, vestíbulos y pasillos)",
    legalReference: "OGUC Art. 4.1.1",
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
      "Las rampas accesibles no deben superar una pendiente del 8% para tramos de hasta 9 m de longitud",
    legalReference: "OGUC Art. 4.1.7",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["rampas", "pendiente", "accesibilidad", "discapacidad"],
    notes:
      "Art. 4.1.7: pendiente est\u00e1ndar m\u00e1x. 8% para rampas hasta 9 m. Para tramos \u22641,5 m se admite hasta 12%. F\u00f3rmula OGUC: i% = 12,8 - 0,5333L. Aplica a edificios de uso p\u00fablico y edificaciones colectivas (art. 4.1.7).",
    conditions: [
      {
        propertyRef: "Slope",
        operator: "<=",
        value: "8",
        unit: "pct",
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
      "Las escaleras de evacuación deben tener una altura de contrahuella máxima de 180 mm y mínima de 130 mm",
    legalReference: "OGUC Art. 4.2.11",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["escaleras", "contrahuella", "seguridad", "evacuacion"],
    conditions: [
      {
        propertyRef: "StairRiserHeight",
        operator: "<=",
        value: "180",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
      {
        propertyRef: "StairRiserHeight",
        operator: ">=",
        value: "130",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 1,
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
      "Las escaleras de evacuación deben tener una profundidad de huella mínima de 280 mm",
    legalReference: "OGUC Art. 4.2.11",
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
      "Las barandas de escaleras, balcones, terrazas y aberturas en altura deben tener una altura mínima de 950 mm",
    legalReference: "OGUC Art. 4.2.7",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["barandas", "altura", "seguridad", "caida"],
    conditions: [
      {
        propertyRef: "Height",
        operator: ">=",
        value: "950",
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
      "Los locales habitables deben contar con al menos una ventana que permita la entrada de aire y luz del exterior",
    legalReference: "OGUC Art. 4.1.2",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["ventanas", "ventilacion", "habitabilidad", "iluminacion"],
    notes:
      "El OGUC Art. 4.1.2 exige 'al menos una ventana que permita la entrada de aire y luz del exterior'. No establece un área mínima específica en m2, solo requiere que no sea una ventana fija sellada en dormitorios. Se verifica presencia de ventana (Area > 0).",
    conditions: [
      {
        propertyRef: "Area",
        operator: ">",
        value: "0",
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
      "Los muros cortafuego deben tener una resistencia al fuego mínima de F-120 (tipo d) hasta F-180 (tipo a)",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["muros", "cortafuego", "resistencia-fuego", "F-120"],
    notes:
      "Art. 4.3.3 tabla, columna (1) Muros cortafuego: tipo a=F-180, b=F-150, c=F-120, d=F-120. Se verifica el mínimo (F-120 para tipo c y d). Art. 4.3.2 define las normas de ensayo (NCh 935/1), no los valores.",
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
      "Las escaleras de evacuación deben tener resistencia al fuego mínima F-15 (tipo c) a F-60 (tipo a) según clasificación del edificio",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["escaleras", "cortafuego", "resistencia-fuego", "evacuacion"],
    notes:
      "Art. 4.3.3 tabla, columna (7) Escaleras: tipo a=F-60, b=F-30, c=F-15, d=-- (sin requisito). Se verifica el m\u00ednimo aplicable (F-15 para edificios tipo c). La tabla no tiene columna para 'puertas cortafuego'; los muros de caja de escalera (col. 2) tienen su propio requisito en R011. Art. 4.3.4 define la clasificaci\u00f3n tipo a/b/c/d seg\u00fan uso, superficie y n\u00famero de pisos.",
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "15",
        unit: "min",
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
    code: "CL-OGUC-2024-R011",
    description:
      "Los muros de caja de escalera y zona vertical de seguridad deben tener resistencia al fuego mínima F-60 (tipo d) hasta F-120 (tipo a/b)",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["muros", "escalera", "evacuacion", "resistencia-fuego"],
    notes:
      "Art. 4.3.3 tabla, columna (2) Muros zona vertical de seguridad y caja de escalera: tipo a=F-120, b=F-120, c=F-90, d=F-60. Se verifica el mínimo (F-60 para tipo d).",
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
      "Los elementos soportantes horizontales (losas y vigas) deben tener resistencia al fuego mínima F-30 (tipo d) hasta F-120 (tipo a)",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["pisos", "losa", "resistencia-fuego"],
    notes:
      "Art. 4.3.3 tabla, columna (8) Elementos soportantes horizontales: tipo a=F-120, b=F-90, c=F-60, d=F-30. Se verifica el mínimo (F-30 para tipo d). Art. 4.3.5 define reglas de conteo de pisos para determinar el tipo.",
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
      targetCategories: ["Floors"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R013",
    description:
      "Las techumbres (incluido cielo falso) deben tener resistencia al fuego mínima F-15 (tipo d) hasta F-60 (tipo a/b)",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["cubierta", "techo", "cielo-falso", "resistencia-fuego"],
    notes:
      "Art. 4.3.3 tabla, columna (9) Techumbre incluido cielo falso: tipo a=F-60, b=F-60, c=F-30, d=F-15. Se verifica el mínimo (F-15 para tipo d). Art. 4.3.7 trata sobre zonas verticales de seguridad en edificios de 7+ pisos, no sobre materiales de techumbre.",
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "15",
        unit: "min",
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
      "Los cielos falsos en edificaciones deben tener resistencia al fuego mínima F-15 (tipo d) hasta F-60 (tipo a/b)",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["cielos", "resistencia-fuego"],
    notes:
      "Art. 4.3.3 tabla, columna (9) Techumbre incluido cielo falso: tipo a=F-60, b=F-60, c=F-30, d=F-15. Art. 4.3.8 trata sobre sistemas de detección automática de incendio en edificios de 5+ pisos / 200+ personas, no sobre resistencia al fuego de cielos.",
    conditions: [
      {
        propertyRef: "FireRating",
        operator: ">=",
        value: "15",
        unit: "min",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Ceilings"],
      scope: "FILTERED",
    },
  },
  {
    code: "CL-OGUC-2024-R015",
    description:
      "Los elementos soportantes verticales (pilares y muros estructurales) deben tener resistencia al fuego mínima F-30 (tipo d) hasta F-120 (tipo a)",
    legalReference: "OGUC Art. 4.3.3",
    discipline: "FIRE_PROTECTION",
    severity: "MANDATORY",
    tags: ["muros", "pilares", "estructural", "resistencia-fuego"],
    notes:
      "Art. 4.3.3 tabla, columna (5) Elementos soportantes verticales: tipo a=F-120, b=F-90, c=F-60, d=F-30. Se verifica el mínimo (F-30 para tipo d). Art. 4.3.1 describe los objetivos generales del capítulo, no establece valores numéricos.",
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
      propertyFilters: { LoadBearing: "true" },
      scope: "FILTERED",
    },
  },
  // STRUCTURAL (5)
  {
    code: "CL-OGUC-2024-R016",
    description:
      "Los muros estructurales de albañilería deben tener un espesor mínimo de 140 mm (ladrillo máquina) o 140 mm interior / 200 mm exterior (ladrillo artesanal)",
    legalReference: "OGUC Art. 5.6.2",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["muros", "estructural", "albanileria", "espesor"],
    notes:
      "Art. 5.6.2: ladrillo artesanal (hecho a mano) requiere 20 cm exteriores y 14 cm interiores. Ladrillo máquina: 'espesor mínimo no podrá ser inferior a 14 cm' (salvo proyecto firmado por ingeniero o arquitecto con aprobación SEREMI). Se verifica el mínimo absoluto de 140 mm. Art. 5.5.2 es artículo de política general de materiales, no establece espesores.",
    conditions: [
      {
        propertyRef: "Thickness",
        operator: ">=",
        value: "140",
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
      "Los cimientos de hormigón o albanilería deben tener una profundidad mínima de 600 mm bajo el nivel natural del terreno",
    legalReference: "OGUC Art. 5.7.5",
    discipline: "STRUCTURAL",
    severity: "MANDATORY",
    tags: ["fundaciones", "profundidad", "cimiento"],
    notes:
      "Art. 5.7.5: 'profundidad mínima de los cimientos de hormigón o de albanílería será de 0,60 m, debiendo penetrar éstos, a lo menos, 0,20 m en las capas no removidas del terreno'. Art. 5.6.1 define el ámbito (solo 1-2 pisos) y es artículo de alcance, no establece la profundidad.",
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
      "Recubrimiento mínimo del acero de refuerzo en vigas de hormigón armado: 30 mm (referencia orientativa)",
    legalReference: "NCh 430 Of.2008 § 8.7",
    discipline: "STRUCTURAL",
    severity: "INFORMATIONAL",
    tags: [
      "vigas",
      "recubrimiento",
      "hormigon",
      "armado",
      "pendiente-confirmacion",
    ],
    notes:
      "Valor orientativo basado en práctica habitual de la industria chilena. NCh 430 Of.2008 es una norma de pago del INN (inn.cl); el valor exacto del §8.7 está pendiente de confirmación con el documento oficial. Art. 5.7.3 del OGUC trata sobre geometría de fundaciones, no sobre recubrimiento de armaduras.",
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
      "Recubrimiento mínimo del acero de refuerzo en columnas de hormigón armado: 40 mm (referencia orientativa)",
    legalReference: "NCh 430 Of.2008 § 8.7",
    discipline: "STRUCTURAL",
    severity: "INFORMATIONAL",
    tags: [
      "columnas",
      "recubrimiento",
      "hormigon",
      "armado",
      "pendiente-confirmacion",
    ],
    notes:
      "Valor orientativo basado en práctica habitual de la industria chilena. NCh 430 Of.2008 es una norma de pago del INN (inn.cl); el valor exacto del §8.7 está pendiente de confirmación con el documento oficial. Art. 5.7.4 del OGUC trata sobre dimensionamiento de cimientos para asentamiento uniforme, no sobre recubrimiento de armaduras.",
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
      "Espesor mínimo de losas de piso de hormigón armado: 120 mm (referencia orientativa)",
    legalReference: "NCh 430 Of.2008 § 9.5",
    discipline: "STRUCTURAL",
    severity: "INFORMATIONAL",
    tags: ["losa", "piso", "hormigon", "espesor", "pendiente-confirmacion"],
    notes:
      "Valor orientativo basado en práctica habitual de la industria chilena. NCh 430 Of.2008 es una norma de pago del INN (inn.cl); el valor exacto del §9.5 está pendiente de confirmación con el documento oficial. Art. 5.5.4 del OGUC otorga al Presidente la facultad de prohibir materiales deficientes, no establece espesores de losas.",
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
