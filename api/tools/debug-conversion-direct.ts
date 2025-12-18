import * as dotenv from "dotenv";
import * as path from "path";
// Load env vars immediately
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { apsAuthService } from "../src/services/aps/auth.service";
import axios from "axios";

const URN =
  "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NDQ3MTcxMjg0OS1TQ0ZBLVBCLVBDMi1BUlEtR0VOLVBMRy0wMDAxLmR3Zw";

async function debugDirect() {
  console.log(
    "🧪 Debugging Model Derivative Direct Call (Manual Job Construction)...",
  );
  console.log(`URN: ${URN}`);

  try {
    console.log("1. Getting Token...");
    const token = await apsAuthService.getInternalToken();

    const job = {
      input: {
        urn: URN,
      },
      output: {
        formats: [
          {
            type: "obj",
          },
        ],
      },
    };

    console.log("2. Sending PDF translation job via REST API...");
    console.log("Payload:", JSON.stringify(job, null, 2));

    const response = await axios.post(
      "https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
      job,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-ads-force": "true",
        },
      },
    );

    console.log("✅ Success:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("❌ Failed:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugDirect();
