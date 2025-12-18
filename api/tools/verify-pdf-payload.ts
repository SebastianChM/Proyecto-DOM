// Set dummy env vars to allow service instantiation
process.env.APS_CLIENT_ID = "dummy";
process.env.APS_CLIENT_SECRET = "dummy";
process.env.APS_CALLBACK_URL = "dummy";

import { APSModelDerivativeService } from "../src/services/aps/model-derivative.service";
import { apsAuthService } from "../src/services/aps/auth.service";
import axios from "axios";

// 1. Mock Auth Token
// We simply overwrite the method on the singleton instance
apsAuthService.getInternalToken = async () => "mock-token";

// 2. Mock Axios POST
// We overwrite the post method on the imported axios object
// @ts-ignore
axios.post = async (url, data) => {
  console.log("\n--- VERIFICATION OUTPUT ---");
  console.log("Target URL:", url);
  console.log("Payload sent to Autodesk:");
  console.log(JSON.stringify(data, null, 2));
  console.log("---------------------------\n");
  return { data: { result: "success" } };
};

// 3. Run Test
async function runTest() {
  console.log("🚀 Starting PDF Payload Verification...");
  const service = new APSModelDerivativeService();

  try {
    await service.translateToPDF("urn:adsk.objects:os.object:test/file.rvt");
    console.log("✅ verification complete: Method executed successfully.");
  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

runTest();
