import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { PrismaClient } from "@prisma/client";
import { modelDerivativeService } from "../src/services/aps/model-derivative.service";

const prisma = new PrismaClient();

async function debugFileProcessing() {
  try {
    const fileName = "MEP_HVAC_L1-L10.ifc";
    console.log(`Searching for file: ${fileName}...`);

    const file = await prisma.file.findFirst({
      where: {
        originalName: {
          contains: fileName,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!file) {
      console.log("File not found in database.");
      return;
    }

    console.log("File found:");
    console.log(`- ID: ${file.id}`);
    console.log(`- Name: ${file.name}`);
    console.log(`- Status: ${file.status}`);
    console.log(`- URN: ${file.apsUrn}`);
    console.log(`- Created At: ${file.createdAt}`);

    if (file.apsUrn) {
      console.log("\nChecking APS Manifest...");
      try {
        const manifest = await modelDerivativeService.getManifest(file.apsUrn);
        console.log(`- APS Status: ${manifest.status}`);
        console.log(`- Progress: ${manifest.progress}`);

        if (manifest.status === "failed") {
          console.error("Translation failed!");
          // console.log(JSON.stringify(manifest, null, 2));
        } else if (manifest.status === "inprogress") {
          console.log("Translation is still in progress.");
        } else if (manifest.status === "success") {
          console.log("Translation completed successfully on APS side.");
          // If DB says processing but APS says success, we might need to update DB
        }
      } catch (apsError) {
        console.error("Error fetching manifest from APS:", apsError);
      }
    } else {
      console.log("No URN found for this file.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFileProcessing();
