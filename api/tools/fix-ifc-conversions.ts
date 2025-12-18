import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { modelDerivativeService } from "../src/services/aps/model-derivative.service";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Fixing stuck IFC conversions...\n");

  // Find stuck IFC conversions
  const stuckConversions = await prisma.conversion.findMany({
    where: {
      targetFormat: "ifc",
      status: "PROCESSING",
    },
    include: { file: true },
  });

  console.log(`Found ${stuckConversions.length} stuck IFC conversions\n`);

  for (const conversion of stuckConversions) {
    console.log(`Checking: ${conversion.file.name}...`);

    if (!conversion.file.apsUrn) {
      console.log("  ❌ No URN\n");
      continue;
    }

    try {
      const manifest = await modelDerivativeService.getManifest(
        conversion.file.apsUrn,
      );

      // Find IFC derivative
      const ifcDerivative = manifest.derivatives?.find(
        (d: any) => d.outputType === "ifc",
      );

      if (ifcDerivative?.status === "success") {
        const ifcResource = ifcDerivative.children?.find(
          (c: any) => c.role === "ifc",
        );

        if (ifcResource?.urn) {
          console.log(`  ✅ IFC ready! URN: ${ifcResource.urn}`);

          // Update the conversion record
          await prisma.conversion.update({
            where: { id: conversion.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              resultUrn: ifcResource.urn,
              resultUrl: `/api/conversion/${conversion.id}/download`,
            },
          });

          console.log(`  ✅ Conversion ${conversion.id} updated to COMPLETED`);
          console.log(
            `  📥 Download URL: /api/conversion/${conversion.id}/download\n`,
          );
        } else {
          console.log("  ⏳ IFC resource not ready yet\n");
        }
      } else if (ifcDerivative?.status === "failed") {
        console.log("  ❌ IFC translation failed\n");
        await prisma.conversion.update({
          where: { id: conversion.id },
          data: { status: "FAILED", error: "IFC translation failed in APS" },
        });
      } else {
        console.log(
          `  ⏳ IFC status: ${ifcDerivative?.status || "not found"}\n`,
        );
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }

  await prisma.$disconnect();
  console.log("Done!");
}

main().catch(console.error);
