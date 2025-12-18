import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Fixing specific stuck conversion...");

  const convId = "ac5f5ef3-9407-4648-bb5c-2f7f642390a3";

  const conv = await prisma.conversion.findUnique({
    where: { id: convId },
  });

  if (!conv) {
    console.log("Conversion not found");
    await prisma.$disconnect();
    return;
  }

  console.log("Found conversion:", conv.status);

  if (conv.status === "PROCESSING" || conv.status === "PENDING") {
    await prisma.conversion.update({
      where: { id: convId },
      data: {
        status: "FAILED",
        error: "Manually cleaned up - conversion was stuck",
        completedAt: new Date(),
      },
    });
    console.log("✅ Marked as FAILED");
  } else {
    console.log("Conversion is not stuck, status:", conv.status);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
