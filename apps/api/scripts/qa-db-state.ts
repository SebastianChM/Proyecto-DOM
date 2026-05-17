import prisma from "../src/lib/prisma";

async function main() {
  const [projects, files, translated, users, packs, runs, config, reqs] =
    await Promise.all([
      prisma.project.count(),
      prisma.file.count(),
      prisma.file.count({ where: { status: "READY" } }),
      prisma.user.count(),
      prisma.regulationPack.count(),
      prisma.complianceRun.count(),
      prisma.projectComplianceConfig.count(),
      prisma.requirement.count(),
    ]);

  console.log("=== DB STATE ===");
  console.log(`Projects:         ${projects}`);
  console.log(`Files total:      ${files}`);
  console.log(`Files TRANSLATED: ${translated}`);
  console.log(`Users:            ${users}`);
  console.log(`RegulationPacks:  ${packs}`);
  console.log(`Requirements:     ${reqs}`);
  console.log(`ComplianceRuns:   ${runs}`);
  console.log(`ComplianceConfig: ${config}`);

  if (translated > 0) {
    const tFiles = await prisma.file.findMany({
      where: { status: "READY", apsUrn: { not: null } },
      take: 10,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        apsUrn: true,
        projectId: true,
      },
    });
    console.log("\n=== TRANSLATED FILES (READY) ===");
    for (const f of tFiles) {
      console.log(
        `  ${f.name} [${f.type}] | projectId=${f.projectId} | urn=${f.apsUrn?.substring(0, 30)}...`,
      );
    }
  }

  if (runs > 0) {
    const recentRuns = await prisma.complianceRun.findMany({
      take: 3,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        projectId: true,
        _count: { select: { issues: true } },
      },
    });
    console.log("\n=== RECENT COMPLIANCE RUNS ===");
    for (const r of recentRuns) {
      console.log(
        `  ${r.id} | ${r.status} | issues=${r._count.issues} | ${r.startedAt?.toISOString()}`,
      );
    }
  }

  if (packs > 0) {
    const packList = await prisma.regulationPack.findMany({
      take: 5,
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        _count: { select: { requirements: true } },
      },
    });
    console.log("\n=== REGULATION PACKS ===");
    for (const p of packList) {
      console.log(
        `  ${p.code} | ${p.name} | ${p.status} | reqs=${p._count.requirements}`,
      );
    }
  }

  // Check frontend pages exist
  console.log("\n=== COMPLIANCE V3 FRONTEND PAGES ===");
  const fs = await import("fs");
  const path = await import("path");
  const webDir = path.join(process.cwd(), "../../apps/web/app/dashboard");
  const complianceDir = path.join(webDir, "compliance");
  const packsPage = path.join(complianceDir, "packs/page.tsx");
  const resultsPage = path.join(complianceDir, "results/page.tsx");
  console.log(
    `  compliance/packs/page.tsx:   ${fs.existsSync(packsPage) ? "EXISTS" : "MISSING"}`,
  );
  console.log(
    `  compliance/results/page.tsx: ${fs.existsSync(resultsPage) ? "EXISTS" : "MISSING"}`,
  );

  // List compliance dir
  if (fs.existsSync(complianceDir)) {
    const entries = fs.readdirSync(complianceDir, { withFileTypes: true });
    console.log(
      `  Compliance dir contents: ${entries.map((e) => e.name).join(", ")}`,
    );
  } else {
    console.log(`  compliance dir: MISSING at ${complianceDir}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
