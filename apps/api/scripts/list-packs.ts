import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(__dirname, "../.env") });

import prisma from "../src/lib/prisma";

async function main() {
  const packs = await prisma.regulationPack.findMany({
    include: { _count: { select: { requirements: true } } },
    orderBy: { code: "asc" },
  });

  for (const p of packs) {
    console.log(
      `\nPACK: ${p.code} | ${p.name} | status: ${p.status} | reqs: ${p._count.requirements}`,
    );

    const reqs = await prisma.requirement.findMany({
      where: { packId: p.id },
      include: { conditions: true, applicability: true },
      orderBy: { code: "asc" },
    });

    for (const r of reqs) {
      const appRow = r.applicability as { targetCategories?: string[] } | null;
      const cats = appRow?.targetCategories ?? [];
      console.log(
        `  [${r.status}] ${r.code} | ${r.severity} | cats: ${cats.join(", ") || "(ninguna)"}`,
      );
      for (const c of r.conditions) {
        console.log(
          `    • ${c.propertyRef} ${c.operator} ${c.value}${c.unit ? " " + c.unit : ""} [${c.logicGroup}]`,
        );
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
