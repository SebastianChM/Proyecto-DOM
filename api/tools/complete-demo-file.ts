import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function completeDemoFile() {
  try {
    const fileName = "MEP_HVAC_L1-L10.ifc";
    console.log(`Updating status for file: ${fileName}...`);

    const file = await prisma.file.findFirst({
      where: {
        originalName: {
          contains: fileName,
        },
        status: "TRANSLATING",
      },
    });

    if (!file) {
      console.log("File not found or not in TRANSLATING state.");
      return;
    }

    // Update to READY
    await prisma.file.update({
      where: { id: file.id },
      data: {
        status: "READY",
        // Add a mock URN so it doesn't look broken if they try to view it (though it won't load in viewer without real URN)
        // But for the dashboard list, status READY is enough.
        apsUrn: file.apsUrn || "local-demo-urn",
      },
    });

    console.log(`✅ File ${fileName} marked as READY.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

completeDemoFile();
