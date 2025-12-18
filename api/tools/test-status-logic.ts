import { PrismaClient } from "@prisma/client";
import { modelDerivativeService } from "../src/services/aps/model-derivative.service";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const prisma = new PrismaClient();

async function testStatusLogic() {
  console.log("🔍 Checking for files in TRANSLATING or PROCESSING state...");

  // Find files that are stuck in processing
  const files = await prisma.file.findMany({
    where: {
      status: {
        in: ["TRANSLATING", "PROCESSING"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (files.length === 0) {
    console.log("⚠️ No files found in TRANSLATING/PROCESSING state.");
    console.log(
      "🔍 Checking most recent file to see its real status on APS...",
    );
    const recentFile = await prisma.file.findFirst({
      where: { apsUrn: { not: null } },
      orderBy: { createdAt: "desc" },
    });

    if (
      recentFile &&
      recentFile.apsUrn &&
      !recentFile.apsUrn.startsWith("local-")
    ) {
      console.log(
        `📄 Checking file: ${recentFile.name} (Status: ${recentFile.status})`,
      );
      await checkFileStatus(recentFile);
    } else {
      console.log("❌ No suitable files found to test.");
    }
    return;
  }

  console.log(`found ${files.length} files processing.`);

  for (const file of files) {
    await checkFileStatus(file);
  }
}

async function checkFileStatus(file: any) {
  console.log(`\n📄 Checking file: ${file.name}`);
  console.log(`   Current DB Status: ${file.status}`);
  console.log(`   URN: ${file.apsUrn}`);

  if (!file.apsUrn || file.apsUrn.startsWith("local-")) {
    console.log("   ⚠️ Local file, skipping APS check.");
    return;
  }

  try {
    console.log("   🌐 Fetching manifest from APS...");
    const manifest = await modelDerivativeService.getManifest(file.apsUrn);
    console.log(`   ✅ APS Manifest Status: ${manifest.status}`);
    console.log(`   📊 Progress: ${manifest.progress}`);

    if (manifest.status === "success") {
      console.log("   ✨ File is READY on APS! Updating DB...");
      // Simulate the update
      const updated = await prisma.file.update({
        where: { id: file.id },
        data: { status: "READY" },
      });
      console.log(`   ✅ DB Updated to: ${updated.status}`);
    } else if (manifest.status === "failed") {
      console.log("   ❌ File FAILED on APS. Updating DB...");
      const updated = await prisma.file.update({
        where: { id: file.id },
        data: { status: "FAILED" },
      });
      console.log(`   ✅ DB Updated to: ${updated.status}`);
    } else {
      console.log("   ⏳ File is still processing on APS.");
    }
  } catch (error: any) {
    console.error("   ❌ Failed to check status:", error.message);
    if (error.response) {
      console.error("   Details:", JSON.stringify(error.response.data));
    }
  }
}

testStatusLogic()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
