/**
 * Full compliance audit — runs after a real architectural model is uploaded.
 *
 * Usage:  npx tsx apps/api/scripts/audit-compliance.ts
 *         npx tsx apps/api/scripts/audit-compliance.ts --project=<projectId>
 *         npx tsx apps/api/scripts/audit-compliance.ts --run=<runId>
 *
 * What it does:
 *   1. Finds the most recent COMPLETED run (or runs the pipeline if needed)
 *   2. Reports element category breakdown
 *   3. Reports issue quality (are elementId, propertyName, values populated?)
 *   4. Validates score consistency
 *   5. Prints 5 sample issues for manual spot-check in Revit
 *   6. Gives a PASS/FAIL verdict per criterion
 */

import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(__dirname, "../.env") });

import prisma from "../src/lib/prisma";
import { cacheService } from "../src/lib/redis";
import { reportService } from "../src/services/reporting/report.service";
import { ComplianceRunnerV3Service } from "../src/services/compliance-v3/compliance-runner-v3.service";
import { projectComplianceConfigService } from "../src/services/compliance-v3/project-config.service";
import fs from "fs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace("--", "").split("=")),
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function pass(label: string, detail = "") {
  console.log(`  ✅ PASS  ${label}${detail ? " — " + detail : ""}`);
}
function fail(label: string, detail = "") {
  console.log(`  ❌ FAIL  ${label}${detail ? " — " + detail : ""}`);
}
function warn(label: string, detail = "") {
  console.log(`  ⚠️  WARN  ${label}${detail ? " — " + detail : ""}`);
}
function section(title: string) {
  console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   DOM BIM — Compliance V3 Full Audit                ║");
  console.log(`╚══════════════════════════════════════════════════════╝`);

  // ── 0. System prerequisites ───────────────────────────────────────────────
  section("0. Infrastructure");

  const dbResult = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW()`;
  pass("PostgreSQL reachable", `server time ${dbResult[0].now.toISOString()}`);

  // ── 1. Find target run ────────────────────────────────────────────────────
  section("1. Finding target compliance run");

  let runId = args.run as string | undefined;

  if (!runId) {
    // Try to find or create a run from a READY file
    const projectId = args.project as string | undefined;

    const fileQuery = projectId
      ? { status: "READY" as const, apsUrn: { not: null as null }, projectId }
      : { status: "READY" as const, apsUrn: { not: null as null } };

    const file = await prisma.file.findFirst({
      where: fileQuery,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        apsUrn: true,
        projectId: true,
        status: true,
      },
    });

    if (!file || !file.apsUrn) {
      console.log(
        "\n❌ BLOQUEANTE: No se encontró ningún archivo con status READY y apsUrn.",
      );
      console.log(
        "   Sube un archivo .rvt o .ifc, espera que traduzca, y vuelve a correr este script.",
      );
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`\n  Archivo encontrado: "${file.name}" [${file.type}]`);
    console.log(`  Project ID: ${file.projectId}`);
    console.log(`  URN: ${file.apsUrn.substring(0, 50)}...`);

    // Check for existing COMPLETED run on this file's project
    const existingRun = await prisma.complianceRun.findFirst({
      where: {
        projectId: file.projectId,
        modelUrn: file.apsUrn,
        status: "COMPLETED",
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true },
    });

    if (existingRun) {
      console.log(`\n  Reutilizando run existente: ${existingRun.id}`);
      runId = existingRun.id;
    } else {
      // Ensure compliance config exists
      let config = await projectComplianceConfigService.getConfig(
        file.projectId,
      );
      if (!config) {
        const pack = await prisma.regulationPack.findFirst({
          where: { status: { in: ["ACTIVE", "PUBLISHED"] } },
          orderBy: { code: "asc" },
          select: { id: true, name: true },
        });
        if (!pack) {
          console.log("\n❌ BLOQUEANTE: No hay packs de normativa en la DB.");
          await prisma.$disconnect();
          process.exit(1);
        }
        console.log(`\n  Creando compliance config con pack "${pack.name}"...`);
        config = await projectComplianceConfigService.upsertConfig(
          file.projectId,
          {
            packIds: [pack.id],
          },
        );
      }

      console.log("\n  Ejecutando compliance run contra APS...");
      const service = new ComplianceRunnerV3Service();
      const result = await service.evaluate(file.projectId, file.apsUrn, {
        dryRun: false,
      });
      runId = result.runId;
      console.log(`  Run ID: ${runId}`);
    }
  }

  // ── 2. Load run data ──────────────────────────────────────────────────────
  section("2. Run results");

  const run = await prisma.complianceRun.findUnique({
    where: { id: runId },
    include: {
      _count: { select: { issues: true } },
      config: { include: { packs: { select: { name: true, code: true } } } },
    },
  });

  if (!run) {
    console.log(`\n❌ Run ${runId} not found`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const meta = (run.metadata as Record<string, unknown>) ?? {};
  const totalElements =
    (meta.totalElements as number) ?? run.totalElements ?? 0;
  const totalRequirements =
    (meta.totalRequirements as number) ?? run.totalRules ?? 0;
  const score = (meta.complianceScore as number) ?? run.complianceScore ?? 0;
  const issueCount = run._count.issues;
  const packNames =
    run.config?.packs?.map((p) => p.code).join(", ") ?? "unknown";

  console.log(`\n  Status:             ${run.status}`);
  console.log(`  Pack(s):            ${packNames}`);
  console.log(`  Total elements:     ${totalElements}`);
  console.log(`  Requirements used:  ${totalRequirements}`);
  console.log(`  Issues found:       ${issueCount}`);
  console.log(`  Compliance score:   ${Math.round(score)}%`);
  if (run.errorMessage)
    console.log(`  Error message:      ${run.errorMessage}`);

  // ── 3. Criterion checks ───────────────────────────────────────────────────
  section("3. Criteria verification");

  const results: { criterion: string; ok: boolean }[] = [];
  function check(label: string, ok: boolean, detail = "") {
    results.push({ criterion: label, ok });
    if (ok) pass(label, detail);
    else fail(label, detail);
  }

  check("C1: Run status is COMPLETED", run.status === "COMPLETED", run.status);

  check(
    "C2: totalElements > 0 (extractor funcionó)",
    totalElements > 0,
    `${totalElements} elements`,
  );

  check(
    "C3: totalRequirements > 0 (packs cargados)",
    totalRequirements > 0,
    `${totalRequirements} reqs`,
  );

  // Score plausibility: if elements exist but score is 100% with 0 issues, suspicious
  const scoreIsSuspicious =
    totalElements > 0 &&
    issueCount === 0 &&
    score >= 100 &&
    totalRequirements > 0;
  if (scoreIsSuspicious) {
    warn(
      "C4: Score plausibility",
      `100% con 0 issues y ${totalElements} elementos — verifica si las categorías del modelo coinciden con los targetCategories de los requirements`,
    );
  } else {
    check(
      "C4: Score plausibility",
      !scoreIsSuspicious,
      `${Math.round(score)}% con ${issueCount} issues`,
    );
  }

  // ── 4. Element category analysis ─────────────────────────────────────────
  section("4. Element category breakdown");

  // Read from Redis cache if available
  const cacheKey = `compliance:model:${run.modelUrn}`;
  type CachedElement = { elementId: string; name: string; category: string };
  const cached = await cacheService.get<CachedElement[]>(cacheKey);

  if (cached && Array.isArray(cached)) {
    const cats: Record<string, number> = {};
    cached.forEach((el) => {
      cats[el.category] = (cats[el.category] ?? 0) + 1;
    });
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    console.log(
      `\n  ${sorted.length} categorías distintas (${cached.length} elementos total):`,
    );
    sorted.slice(0, 20).forEach(([cat, count]) => {
      console.log(`    ${String(count).padStart(5)}  ${cat}`);
    });
    if (sorted.length > 20) {
      console.log(`    ... y ${sorted.length - 20} categorías más`);
    }

    // Check if any requirement target categories overlap with actual categories
    const requirements = await prisma.requirement.findMany({
      select: { code: true, applicability: true },
      take: 100,
    });
    const targetCats = new Set<string>();
    requirements.forEach((r) => {
      const app = r.applicability as { targetCategories?: string[] } | null;
      app?.targetCategories?.forEach((c) => targetCats.add(c.toLowerCase()));
    });
    const actualCatsLower = new Set(sorted.map(([c]) => c.toLowerCase()));
    const overlap = [...targetCats].filter((c) => actualCatsLower.has(c));

    if (overlap.length > 0) {
      pass(
        "C5: Category overlap with requirements",
        `${overlap.length} categorías coinciden: ${overlap.slice(0, 5).join(", ")}`,
      );
    } else {
      fail(
        "C5: Category overlap with requirements",
        `Ninguna categoría del modelo coincide con targetCategories de los requirements.\nModelo tiene: ${sorted
          .slice(0, 5)
          .map(([c]) => c)
          .join(
            ", ",
          )}\nRequirements esperan: ${[...targetCats].slice(0, 5).join(", ")}`,
      );
      warn(
        "Diagnóstico",
        "El modelo puede ser de una disciplina diferente al pack seleccionado (ej: modelo eléctrico vs pack OGUC arquitectónico). Prueba con otro pack o un modelo arquitectónico.",
      );
    }
  } else {
    warn(
      "C5: Category analysis",
      "No hay cache Redis del modelo — las categorías no están disponibles sin re-ejecutar el run.",
    );
  }

  // ── 5. Issue quality audit ────────────────────────────────────────────────
  section("5. Issue quality audit");

  if (issueCount === 0) {
    warn("No hay issues que auditar (0 issues en el run)");
  } else {
    const issues = await prisma.complianceIssue.findMany({
      where: { runId: run.id },
      take: 200,
    });

    const emptyElementId = issues.filter(
      (i) => !i.elementId || i.elementId === "unknown",
    ).length;
    const emptyCategory = issues.filter(
      (i) => !i.elementCategory || i.elementCategory === "Unknown",
    ).length;
    const emptyProp = issues.filter(
      (i) => !i.propertyName || i.propertyName === "N/A",
    ).length;
    const sameValues = issues.filter(
      (i) => i.expectedValue === i.actualValue && i.expectedValue !== "N/A",
    ).length;
    const emptyLegalRef = issues.filter((i) => !i.legalReference).length;

    check(
      "C6: elementId populated",
      emptyElementId === 0,
      `${emptyElementId}/${issues.length} vacíos`,
    );
    check(
      "C7: elementCategory populated",
      emptyCategory === 0,
      `${emptyCategory}/${issues.length} desconocidos`,
    );
    check(
      "C8: propertyName populated",
      emptyProp === 0,
      `${emptyProp}/${issues.length} sin propertyName`,
    );
    check(
      "C9: expectedValue ≠ actualValue",
      sameValues === 0,
      `${sameValues}/${issues.length} con valores iguales`,
    );
    if (emptyLegalRef > 0) {
      warn(
        "C10: legalReference populated",
        `${emptyLegalRef}/${issues.length} sin referencia legal`,
      );
    } else {
      pass("C10: legalReference populated");
    }

    // Severity distribution
    const bySeverity: Record<string, number> = {};
    issues.forEach((i) => {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    });
    console.log("\n  Distribución por severidad:");
    Object.entries(bySeverity).forEach(([s, c]) =>
      console.log(`    ${s}: ${c}`),
    );

    // ── 6. Sample issues for manual verification ───────────────────────────
    section("6. Issues de muestra (verificar manualmente en Revit)");

    const sample = issues.slice(0, 5);
    sample.forEach((issue, i) => {
      console.log(`\n  Issue #${i + 1}:`);
      console.log(`    elementId:       ${issue.elementId}`);
      console.log(`    elementName:     ${issue.elementName}`);
      console.log(`    elementCategory: ${issue.elementCategory}`);
      console.log(`    propertyName:    ${issue.propertyName}`);
      console.log(`    expectedValue:   ${issue.expectedValue}`);
      console.log(`    actualValue:     ${issue.actualValue}`);
      console.log(`    severity:        ${issue.severity}`);
      console.log(`    legalReference:  ${issue.legalReference ?? "(vacío)"}`);
      console.log(`    ruleName:        ${issue.ruleName}`);
    });
    console.log(
      "\n  → Abre el modelo en Revit, busca estos elementIds y verifica manualmente.",
    );
  }

  // ── 7. PDF export test ────────────────────────────────────────────────────
  section("7. PDF export");

  try {
    const issuesForPdf = await prisma.complianceIssue.findMany({
      where: { runId: run.id },
      orderBy: [{ severity: "asc" }],
    });
    const project = await prisma.project.findUnique({
      where: { id: run.projectId },
      select: { name: true },
    });
    const mapRow = (i: (typeof issuesForPdf)[number]) => ({
      ruleName: i.ruleName,
      elementName: i.elementName,
      elementCategory: i.elementCategory,
      propertyName: i.propertyName,
      expectedValue: i.expectedValue,
      actualValue: i.actualValue,
    });

    const pdfBuf = await reportService.generateComplianceReport({
      runId: run.id,
      projectName: project?.name ?? run.projectId,
      packName: packNames,
      score: Math.round(score),
      totalElements,
      criticalIssues: issuesForPdf
        .filter((i) => i.severity === "CRITICAL")
        .map(mapRow),
      warningIssues: issuesForPdf
        .filter((i) => i.severity === "WARNING")
        .map(mapRow),
      infoIssues: issuesForPdf.filter((i) => i.severity === "INFO").map(mapRow),
      generatedAt: new Date().toLocaleString("es-CL"),
    });

    const outPath = path.resolve(
      __dirname,
      `../audit-report-${run.id.substring(0, 8)}.pdf`,
    );
    fs.writeFileSync(outPath, pdfBuf);
    pass(
      "C11: PDF generado",
      `${Math.round(pdfBuf.length / 1024)} KB → ${path.basename(outPath)}`,
    );
    console.log(`  → ${outPath}`);
  } catch (e) {
    fail("C11: PDF generado", (e as Error).message);
  }

  // ── 8. Final verdict ──────────────────────────────────────────────────────
  section("VEREDICTO FINAL");

  const failedCriteria = results.filter((r) => !r.ok);

  if (failedCriteria.length === 0) {
    console.log("\n  ✅ LISTO PARA ARQUITECTOS");
    console.log(
      `     Run ${run.id} completado: ${totalElements} elementos, ${issueCount} issues, score ${Math.round(score)}%`,
    );
  } else {
    console.log("\n  ❌ NO LISTO — Criterios fallidos:");
    failedCriteria.forEach((r) => console.log(`     • ${r.criterion}`));
  }

  console.log(`\n  runId: ${run.id}`);
  console.log(`  Fecha: ${new Date().toISOString()}\n`);

  await prisma.$disconnect();
  process.exit(failedCriteria.length > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error("\n❌ Error fatal:", err instanceof Error ? err.message : err);
  prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
