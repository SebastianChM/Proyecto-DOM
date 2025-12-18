import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables BEFORE importing services
const envPath = path.resolve(__dirname, "../../.env");
console.log(`Loading .env from: ${envPath}`);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(
    "APS_CLIENT_ID:",
    process.env.APS_CLIENT_ID ? "Found" : "Missing",
  );
} else {
  console.error("❌ .env file not found!");
}

import { apsOssService } from "../src/services/aps/oss.service";

async function testUpload() {
  console.log("🧪 Testing OSS Upload...");

  try {
    // const buffer = Buffer.from('Hello World Test Content ' + new Date().toISOString());
    // const filename = 'test-upload-script.txt';

    const filePath = path.join(__dirname, "../downloads/mock-result.ifc");
    if (!fs.existsSync(filePath)) {
      console.error("❌ File not found:", filePath);
      return;
    }
    const buffer = fs.readFileSync(filePath);
    const filename = "mock-result.ifc";

    console.log(`Preparing to upload ${filename} (${buffer.length} bytes)...`);

    const result = await apsOssService.uploadBuffer(buffer, filename);

    console.log("✅ Upload successful!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("❌ Upload failed!");
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2),
      );
    }
  }
}

testUpload();
