import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { apsAuthService } from "../src/services/aps/auth.service";

const TARGET_URN =
  "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTMyNTQ1OTkxNy1DTUEtSURPLUlELUVMWC1YLVgtMTktMDAwMC0wMC5ydnQ";

async function main() {
  console.log("🧪 Testing DWF Export (Alternative to PDF)...");

  const token = await apsAuthService.getInternalToken();

  // DWF export is supported for Revit files via Model Derivative
  const job = {
    input: { urn: TARGET_URN },
    output: {
      destination: { region: "us" },
      formats: [{ type: "dwf" }],
    },
  };

  console.log("📤 Submitting DWF translation job...");

  try {
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

    console.log("✅ DWF Translation job started successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    console.log(
      "\n📌 Note: DWF can be viewed in Autodesk Design Review or converted to PDF later.",
    );
  } catch (error: any) {
    console.error("❌ DWF Translation failed:");
    console.error("Error:", error.response?.data || error.message);
  }
}

main();
