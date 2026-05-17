/**
 * Smoke test: end-to-end compliance run without OAuth or HTTP.
 *
 * Usage:  npx tsx apps/api/scripts/smoke-compliance.ts
 *
 * Exit codes:
 *   0 — COMPLETED with totalElements > 0, or SKIP (no translated files)
 *   1 — FAILED / ERROR / unexpected state
 */

// Load .env before any service imports
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(__dirname, "../.env") });

import prisma from "../src/lib/prisma";
import { ComplianceRunnerV3Service } from "../src/services/compliance-v3/compliance-runner-v3.service";
import { projectComplianceConfigService } from "../src/services/compliance-v3/project-config.service";

const FILE_TRANSLATED_STATUS = "READY";

async function main(): Promise<void> {
  console.log("=== DOM Compliance V3 Smoke Test ===\n");

  // 1. Find a project that has at least one READY (translated) file
  const translatedFile = await prisma.file.findFirst({
    where: {
      status: FILE_TRANSLATED_STATUS,
      apsUrn: { not: null },
    },
    select: {
      id: true,
      name: true,
      apsUrn: true,
      projectId: true,
      status: true,
    },
  });

  if (!translatedFile || !translatedFile.apsUrn) {
    console.log("SKIP: No translated files found in the database.");
    console.log(
      "      Upload and translate a BIM model before running this test.",
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`Found translated file: "${translatedFile.name}"`);
  console.log(`  File ID:   ${translatedFile.id}`);
  console.log(`  Project:   ${translatedFile.projectId}`);
  console.log(`  URN:       ${translatedFile.apsUrn.substring(0, 40)}...`);

  const projectId = translatedFile.projectId;

  // 2. Ensure there is a compliance config for this project
  let complianceConfig =
    await projectComplianceConfigService.getConfig(projectId);

  if (!complianceConfig) {
    // Find the first active pack and create a minimal config so the run can proceed
    const pack = await prisma.regulationPack.findFirst({
      where: { status: { in: ["ACTIVE", "PUBLISHED"] } },
      select: { id: true, name: true, code: true },
    });

    if (!pack) {
      console.log("SKIP: No active regulation packs found in the database.");
      console.log("      Seed the database with regulation packs first.");
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(
      `\nNo compliance config for project — creating one with pack "${pack.name}"...`,
    );
    complianceConfig = await projectComplianceConfigService.upsertConfig(
      projectId,
      {
        packIds: [pack.id],
      },
    );
    console.log(`  Config created: ${(complianceConfig as { id: string }).id}`);
  } else {
    console.log(
      `\nCompliance config found: ${(complianceConfig as { id: string }).id}`,
    );
  }

  // 3. Invoke the runner directly (no HTTP)
  const service = new ComplianceRunnerV3Service();
  console.log("\nStarting compliance run...");

  const { runId } = await service.evaluate(
    projectId,
    translatedFile.apsUrn,
    { dryRun: false },
    undefined, // no userId
  );

  console.log(`  Run ID: ${runId}`);

  // 4. Read the result from DB
  const run = await prisma.complianceRun.findUnique({
    where: { id: runId },
    include: { _count: { select: { issues: true } } },
  });

  if (!run) {
    console.error("ERROR: Run was created but not found in DB.");
    await prisma.$disconnect();
    process.exit(1);
  }

  const metadata = (run.metadata as Record<string, unknown> | null) ?? {};
  const totalElements =
    typeof metadata.totalElements === "number"
      ? metadata.totalElements
      : (run.totalElements ?? 0);
  const score =
    typeof metadata.complianceScore === "number"
      ? Math.round(metadata.complianceScore)
      : Math.round(run.complianceScore ?? 0);

  console.log("\n=== RESULT ===");
  console.log(`  Status:         ${run.status}`);
  console.log(`  Total Elements: ${totalElements}`);
  console.log(`  Issue Count:    ${run._count.issues}`);
  console.log(`  Score:          ${score}%`);
  if (run.errorMessage) {
    console.log(`  Error:          ${run.errorMessage}`);
  }

  await prisma.$disconnect();

  if (run.status === "COMPLETED" && totalElements > 0) {
    console.log("\n✅ PASS — compliance run completed with real elements.");
    process.exit(0);
  }

  if (run.status === "FAILED" && run.errorMessage) {
    console.log("\n⚠️  FAILED (expected if model is not fully extracted):");
    console.log(`   ${run.errorMessage}`);
    process.exit(1);
  }

  if (run.status === "COMPLETED" && totalElements === 0) {
    // This should never happen after Task 3 guard
    console.error(
      "\n❌ UNEXPECTED: Run COMPLETED with 0 elements — guard not triggered.",
    );
    process.exit(1);
  }

  console.error(`\n❌ Unexpected run state: ${run.status}`);
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(
    "\n❌ Unhandled error:",
    err instanceof Error ? err.message : err,
  );
  prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
