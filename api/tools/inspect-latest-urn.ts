import dotenv from "dotenv";
import path from "path";

// Load environment variables BEFORE importing services that depend on them
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { apsAuthService } from "../src/services/aps/auth.service";
import { APSModelDerivativeService } from "../src/services/aps/model-derivative.service";
import prisma from "../src/lib/prisma"; // Assumes this exports the prisma client instance

const modelDerivativeService = new APSModelDerivativeService();

async function inspectLatest() {
  console.log("🚀 Inspecting Latest File Manifest...");

  try {
    const file = await prisma.file.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!file) {
      console.log("❌ No files found in database.");
      return;
    }

    console.log(`📂 Found Latest File: ${file.name}`);
    console.log(`🔑 URN: ${file.apsUrn}`);
    console.log(`📅 Created At: ${file.createdAt}`);

    if (!file.apsUrn || file.apsUrn === "UPLOADING") {
      console.log("⚠️ File has no valid URN yet.");
      return;
    }

    console.log("🔍 Fetching manifest from Autodesk...");
    const manifest = await modelDerivativeService.getManifest(file.apsUrn);

    console.log("--- MANIFEST JSON START ---");
    console.log(JSON.stringify(manifest, null, 2));
    console.log("--- MANIFEST JSON END ---");

    // Analyze for PDF
    const hasPdf = manifest.derivatives?.some(
      (d: any) => d.outputType === "pdf",
    );

    // Also check specifically for svf2 derivatives that might contain the PDF
    const svf2Derivative = manifest.derivatives?.find(
      (d: any) => d.outputType === "svf2",
    );
    console.log("SVF2 Derivative found:", !!svf2Derivative);
    if (svf2Derivative) {
      console.log(
        "SVF2 Children:",
        JSON.stringify(svf2Derivative.children, null, 2),
      );
    }

    if (hasPdf) {
      console.log("✅ PDF output type found in top-level derivatives.");
    } else {
      console.warn("⚠️ NO top-level PDF output found.");
    }
  } catch (error: any) {
    console.error("❌ Error:", error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

inspectLatest();
