import { PrismaClient } from "@prisma/client";
import axios from "axios";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables BEFORE importing services
const envPath = path.resolve(__dirname, "../../.env");
console.log("Loading .env from:", envPath);
dotenv.config({ path: envPath });
console.log("APS_CLIENT_ID:", process.env.APS_CLIENT_ID ? "Found" : "Missing");

// Import services after env vars are loaded
const {
  modelDerivativeService,
} = require("../src/services/aps/model-derivative.service");
const { apsOssService } = require("../src/services/aps/oss.service");

const prisma = new PrismaClient();

async function debugSaveFlow() {
  console.log("🔍 Finding recent completed conversions...");

  const conversions = await prisma.conversion.findMany({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 5,
    include: { file: true },
  });

  console.log(`Found ${conversions.length} conversions.`);
  conversions.forEach((c, i) => {
    console.log(
      `${i}: ID=${c.id} File=${c.file.name} ResultURN=${c.resultUrn}`,
    );
  });

  // Pick the first one that doesn't look like a mock
  const conversion = conversions.find(
    (c) => c.resultUrn && !c.resultUrn.includes("mock"),
  );

  if (!conversion) {
    console.error("❌ No valid completed conversion found to test with.");
    console.log(
      "⚠️  Tip: Run test-oss-upload.ts and test-svf-translation.ts to generate real data.",
    );
    return;
  }

  /*
    // HARDCODED URNs for testing (Uncomment if DB is empty/mocked)
    const apsUrn = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NDU1NDE0MDE0OC1tb2NrLXJlc3VsdC5pZmM';
    const resultUrn = 'urn:adsk.viewing:fs.file:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NDU1NDE0MDE0OC1tb2NrLXJlc3VsdC5pZmM/output/0/0.svf';
    const targetFormat = 'svf';
    
    const conversion = {
        id: 'manual-test',
        file: { apsUrn, name: 'manual-test.ifc' },
        resultUrn,
        targetFormat
    };
    */

  console.log(`✅ Found conversion: ${conversion.id}`);
  console.log(`   File: ${conversion.file.name} (${conversion.file.apsUrn})`);
  console.log(`   Result URN: ${conversion.resultUrn}`);
  console.log(`   Format: ${conversion.targetFormat}`);

  if (!conversion.file.apsUrn || !conversion.resultUrn) {
    console.error("❌ Missing URNs");
    return;
  }

  console.log(`✅ Found conversion: ${conversion.id}`);
  console.log(`   File: ${conversion.file.name} (${conversion.file.apsUrn})`);
  console.log(`   Result URN: ${conversion.resultUrn}`);
  console.log(`   Format: ${conversion.targetFormat}`);

  if (!conversion.file.apsUrn || !conversion.resultUrn) {
    console.error("❌ Missing URNs");
    return;
  }

  try {
    // Step 1: Get Download URL
    console.log("\n1️⃣ Testing Signed Cookie Download URL...");
    const { url: downloadUrl, headers: downloadHeaders } =
      await modelDerivativeService.getDerivativeDownloadInfo(
        conversion.file.apsUrn,
        conversion.resultUrn,
      );
    console.log("✅ Got URL:", downloadUrl.substring(0, 50) + "...");
    console.log("✅ Got Headers:", JSON.stringify(downloadHeaders));

    // Step 2: Download File
    console.log("\n2️⃣ Testing File Download...");
    const response = await axios.get(downloadUrl, {
      headers: downloadHeaders,
      responseType: "arraybuffer",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const buffer = Buffer.from(response.data);
    console.log(`✅ Downloaded ${buffer.length} bytes`);

    // Step 3: Upload to OSS
    console.log("\n3️⃣ Testing OSS Upload (Direct S3)...");
    const newFilename = `debug-save-${Date.now()}.${conversion.targetFormat}`;
    const uploadedObject = await apsOssService.uploadBuffer(
      buffer,
      newFilename,
    );
    console.log(`✅ Uploaded to OSS: ${uploadedObject.objectId}`);

    // Step 4: DB Creation (Dry Run)
    console.log("\n4️⃣ Testing DB Record Creation (Dry Run)...");

    console.log("✅ All steps passed successfully!");
  } catch (error: any) {
    console.error("\n❌ TEST FAILED");
    console.error("Message:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Stack:", error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

debugSaveFlow();
