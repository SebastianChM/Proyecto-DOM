/**
 * Legacy Compliance Data Migration Script
 *
 * Migrates Ruleset -> RegulationPack and Rule -> Requirement + RequirementCondition + ApplicabilityRule.
 * Idempotent: uses LEGACY-{discipline}-V1 code as unique key to skip already-migrated packs.
 * Original Ruleset/Rule data remains INTACT.
 *
 * Usage: npx tsx packages/database/prisma/migrate-legacy-compliance.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Severity mapping: Rule.severity -> Requirement.severity
const SEVERITY_MAP: Record<string, string> = {
  CRITICAL: "MANDATORY",
  WARNING: "RECOMMENDED",
  INFO: "INFO",
};

async function migrate() {
  console.info("[MIGRATE] Starting legacy compliance data migration...");

  const rulesets = await prisma.ruleset.findMany({
    include: { rules: true },
  });

  if (rulesets.length === 0) {
    console.info("[MIGRATE] No legacy rulesets found. Nothing to migrate.");
    return { rulesets: 0, rules: 0 };
  }

  let migratedPacks = 0;
  let migratedRequirements = 0;
  let skippedPacks = 0;

  for (const ruleset of rulesets) {
    const packCode = `LEGACY-${ruleset.discipline}-V1`;

    // Idempotency: skip if pack already exists
    const existing = await prisma.regulationPack.findUnique({
      where: { code: packCode },
    });

    if (existing) {
      console.info(
        `[MIGRATE] Pack "${packCode}" already exists (id: ${existing.id}). Skipping.`,
      );
      skippedPacks++;
      continue;
    }

    // Create RegulationPack from Ruleset inside a transaction
    await prisma.$transaction(async (tx) => {
      const pack = await tx.regulationPack.create({
        data: {
          code: packCode,
          name: ruleset.name,
          description: ruleset.description,
          country: "CL",
          version: "1.0-legacy",
          status: "PUBLISHED",
          scope: [ruleset.discipline],
          publishedAt: new Date(),
        },
      });

      console.info(
        `[MIGRATE] Created RegulationPack "${pack.code}" (id: ${pack.id}) from Ruleset "${ruleset.name}"`,
      );
      migratedPacks++;

      // Migrate each Rule -> Requirement + RequirementCondition + ApplicabilityRule
      for (const rule of ruleset.rules) {
        if (!rule.isActive) {
          console.info(
            `[MIGRATE]   Skipping inactive rule "${rule.name}" (id: ${rule.id})`,
          );
          continue;
        }

        const ruleIndex = migratedRequirements + 1;
        const requirementCode = `${packCode}-R${String(ruleIndex).padStart(3, "0")}`;

        const requirement = await tx.requirement.create({
          data: {
            code: requirementCode,
            packId: pack.id,
            description: rule.name,
            legalReference: rule.sourceDocument ?? "Legacy rule (no reference)",
            discipline: ruleset.discipline,
            severity: SEVERITY_MAP[rule.severity] ?? "RECOMMENDED",
            tags: [],
            status: "ACTIVE",
            notes: rule.description ?? undefined,
          },
        });

        // Create RequirementCondition from Rule's property check
        await tx.requirementCondition.create({
          data: {
            requirementId: requirement.id,
            propertyRef: rule.propertyName,
            operator: rule.operator,
            value: rule.expectedValue,
            unit: rule.unit ?? undefined,
            tolerance:
              rule.tolerance != null ? rule.tolerance / 100 : undefined,
            logicGroup: "AND",
            sortOrder: 0,
          },
        });

        // Create ApplicabilityRule from Rule's targetCategory
        await tx.applicabilityRule.create({
          data: {
            requirementId: requirement.id,
            targetCategories: [rule.targetCategory],
            excludeCategories: [],
            scope: "FILTERED",
          },
        });

        migratedRequirements++;
        console.info(
          `[MIGRATE]   Migrated rule "${rule.name}" -> Requirement "${requirementCode}"`,
        );
      }
    });
  }

  return {
    rulesets: migratedPacks,
    rules: migratedRequirements,
    skipped: skippedPacks,
  };
}

async function main() {
  try {
    const result = await migrate();
    console.info("[MIGRATE] ========================================");
    console.info("[MIGRATE] Migration complete!");
    console.info(`[MIGRATE]   Rulesets migrated: ${result.rulesets}`);
    console.info(`[MIGRATE]   Rules migrated:    ${result.rules}`);
    if (result.skipped) {
      console.info(
        `[MIGRATE]   Packs skipped (already existed): ${result.skipped}`,
      );
    }
    console.info("[MIGRATE] ========================================");
    console.info(
      "[MIGRATE] Original Ruleset/Rule data remains intact.",
    );
  } catch (error) {
    console.error("[MIGRATE] Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
