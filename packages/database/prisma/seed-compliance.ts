/**
 * Seed script for Compliance Engine V2
 * Creates example rulesets and rules for electrical discipline
 *
 * Run with: npx ts-node prisma/seed-compliance.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Compliance Engine V2...");

  // Create default electrical ruleset
  const electricalRuleset = await prisma.ruleset.upsert({
    where: { id: "default-electrical" },
    update: {},
    create: {
      id: "default-electrical",
      name: "Validación Eléctrica Estándar",
      description:
        "Reglas estándar para validación de instalaciones eléctricas según normativa",
      discipline: "ELECTRICAL",
      isDefault: true,
    },
  });

  console.log(`✅ Created Ruleset: ${electricalRuleset.name}`);

  // Define example rules for electrical discipline
  const electricalRules = [
    // Cable Trays
    {
      name: "Ancho Mínimo Bandeja Portacables",
      description:
        "Verificar que el ancho de las bandejas cumpla con el mínimo especificado",
      targetCategory: "Cable Trays",
      propertyName: "Width",
      operator: ">=",
      expectedValue: "100",
      unit: "mm",
      tolerance: 5,
      severity: "WARNING",
      sourceDocument: "ET Eléctrico - Sección 3.1",
    },
    {
      name: "Alto Máximo Bandeja Portacables",
      description:
        "Verificar que la altura de las bandejas no exceda el máximo permitido",
      targetCategory: "Cable Trays",
      propertyName: "Height",
      operator: "<=",
      expectedValue: "150",
      unit: "mm",
      tolerance: 5,
      severity: "WARNING",
      sourceDocument: "ET Eléctrico - Sección 3.1",
    },
    // Conduits
    {
      name: "Diámetro Mínimo Conduit EMT",
      description: "Verificar que el diámetro de conduits sea al menos 20mm",
      targetCategory: "Conduits",
      propertyName: "Diameter",
      operator: ">=",
      expectedValue: "20",
      unit: "mm",
      tolerance: 1,
      severity: "CRITICAL",
      sourceDocument: "ET Eléctrico - Sección 4.2",
    },
    // Lighting
    {
      name: "Potencia Luminarias LED",
      description:
        "Verificar que las luminarias tengan la potencia especificada",
      targetCategory: "Lighting Fixtures",
      propertyName: "Electrical Load",
      operator: ">=",
      expectedValue: "30",
      unit: "W",
      tolerance: 5,
      severity: "WARNING",
      sourceDocument: "ET Eléctrico - Sección 5.1",
    },
    {
      name: "Voltaje Luminarias",
      description: "Verificar que las luminarias operen a 220V",
      targetCategory: "Lighting Fixtures",
      propertyName: "Voltage",
      operator: "==",
      expectedValue: "220",
      unit: "V",
      tolerance: 10,
      severity: "CRITICAL",
      sourceDocument: "ET Eléctrico - Sección 5.1",
    },
    // Electrical Equipment
    {
      name: "Capacidad Mínima Tablero General",
      description: "Verificar capacidad mínima de tableros principales",
      targetCategory: "Electrical Equipment",
      propertyName: "Rating",
      operator: ">=",
      expectedValue: "100",
      unit: "A",
      tolerance: 0,
      severity: "CRITICAL",
      sourceDocument: "ET Eléctrico - Sección 2.1",
    },
  ];

  // Create rules
  for (const rule of electricalRules) {
    const created = await prisma.rule.upsert({
      where: {
        id: `rule-${rule.name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`,
      },
      update: rule,
      create: {
        id: `rule-${rule.name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`,
        ...rule,
        rulesetId: electricalRuleset.id,
        isActive: true,
      },
    });
    console.log(`   ✅ Rule: ${created.name}`);
  }

  // Create default structural ruleset
  const structuralRuleset = await prisma.ruleset.upsert({
    where: { id: "default-structural" },
    update: {},
    create: {
      id: "default-structural",
      name: "Validación Estructural Estándar",
      description: "Reglas estándar para validación de elementos estructurales",
      discipline: "STRUCTURAL",
      isDefault: true,
    },
  });

  console.log(`✅ Created Ruleset: ${structuralRuleset.name}`);

  const structuralRules = [
    {
      name: "Resistencia Hormigón Columnas",
      description:
        "Verificar que el hormigón tenga la resistencia especificada",
      targetCategory: "Structural Columns",
      propertyName: "Concrete Grade",
      operator: ">=",
      expectedValue: "30",
      unit: "MPa",
      tolerance: 0,
      severity: "CRITICAL",
      sourceDocument: "ET Estructural - Sección 2.1",
    },
    {
      name: "Dimensión Mínima Columnas",
      description: "Verificar dimensiones mínimas de columnas",
      targetCategory: "Structural Columns",
      propertyName: "Width",
      operator: ">=",
      expectedValue: "300",
      unit: "mm",
      tolerance: 10,
      severity: "CRITICAL",
      sourceDocument: "ET Estructural - Sección 2.2",
    },
  ];

  for (const rule of structuralRules) {
    const created = await prisma.rule.upsert({
      where: {
        id: `rule-${rule.name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`,
      },
      update: rule,
      create: {
        id: `rule-${rule.name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`,
        ...rule,
        rulesetId: structuralRuleset.id,
        isActive: true,
      },
    });
    console.log(`   ✅ Rule: ${created.name}`);
  }

  console.log("\n📊 Summary:");
  const rulesetCount = await prisma.ruleset.count();
  const ruleCount = await prisma.rule.count();
  console.log(`   Rulesets: ${rulesetCount}`);
  console.log(`   Rules: ${ruleCount}`);

  console.log("\n✅ Compliance Engine V2 seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
