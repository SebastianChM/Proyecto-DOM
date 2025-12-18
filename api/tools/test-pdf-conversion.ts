import dotenv from "dotenv";
import path from "path";

// Load environment variables BEFORE importing services that depend on them
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { apsAuthService } from "../src/services/aps/auth.service";
import { APSModelDerivativeService } from "../src/services/aps/model-derivative.service";

const modelDerivativeService = new APSModelDerivativeService();

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("🚀 Starting PDF Conversion Test Script");

  // URN identified from logs: SCFA-PB-CCA-ARQ-GEN-PLP-1001.dwg
  const urn =
    "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTQ2NDY3NjEyOC1TQ0ZBLVBCLUNDQS1BUlEtR0VOLVBMUC0xMDAxLmR3Zw";

  try {
    console.log(`📂 Testing for URN: ${urn}`);

    // 1. Check existing manifest
    console.log("🔍 Checking existing manifest...");
    try {
      const manifest = await modelDerivativeService.getManifest(urn);
      console.log(`ℹ️ Existing manifest status: ${manifest.status}`);

      // 2. Delete if failed or just to be sure we test a fresh conversion
      console.log("🗑️ Deleting manifest to force clean conversion...");
      await modelDerivativeService.deleteManifest(urn);
      console.log("✅ Manifest deletion requested.");

      await delay(3000); // Wait for Autodesk to process deletion
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log("ℹ️ No existing manifest found (404). Ready to convert.");
      } else {
        console.warn("⚠️ Error checking manifest:", error.message);
      }
    }

    // 3. Start PDF Translation
    console.log("📄 Starting Direct PDF Translation via Model Derivative...");

    // Simulating the code in conversion.worker.ts (with DA disabled)
    const jobResult = await modelDerivativeService.translateToPDF(urn);
    console.log(
      "✅ Job submitted successfully:",
      JSON.stringify(jobResult, null, 2),
    );

    // 4. Poll for status
    console.log("⏳ Polling for completion (timeout 5 mins)...");

    const maxAttempts = 60;
    for (let i = 1; i <= maxAttempts; i++) {
      await delay(5000);

      try {
        const manifest = await modelDerivativeService.getManifest(urn);
        console.log(
          `[Attempt ${i}/${maxAttempts}] Status: ${manifest.status}, Progress: ${manifest.progress}`,
        );

        if (manifest.status === "success") {
          console.log("🎉 CONVERSION SUCCESS!");

          // Check if derivatives contain PDF
          const hasPdf = manifest.derivatives?.some(
            (d: any) => d.outputType === "pdf",
          );
          if (hasPdf) {
            console.log("✅ PDF output confirmed in manifest.");
          } else {
            console.warn(
              '⚠️ Manifest status is success but no outputType="pdf" found directly.',
            );
          }
          return;
        }

        if (manifest.status === "failed") {
          console.error("❌ CONVERSION FAILED!");
          const errorDetails = manifest.derivatives?.find(
            (d: any) => d.status === "failed",
          )?.messages;
          if (errorDetails) {
            console.error("Errors:", JSON.stringify(errorDetails, null, 2));
          }
          return;
        }
      } catch (pollError: any) {
        console.warn(`⚠️ Poll error: ${pollError.message}`);
      }
    }

    console.error("❌ Timed out waiting for conversion.");
  } catch (error: any) {
    console.error("❌ Fatal Error:", error.response?.data || error.message);
    if (error.response?.data) {
      console.error("Diagnostic:", error.response.data);
    }
  }
}

runTest();
