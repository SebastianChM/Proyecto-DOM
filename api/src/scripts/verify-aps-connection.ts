import dotenv from "dotenv";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AuthClientTwoLegged } = require("forge-apis");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function verifyConnection() {
  console.log("🔍 Testing Autodesk Platform Services Connection...");

  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ Missing Credentials in .env");
    console.log("APS_CLIENT_ID:", !!clientId);
    console.log("APS_CLIENT_SECRET:", !!clientSecret);
    process.exit(1);
  }

  console.log("✅ Credentials found.");

  try {
    const auth = new AuthClientTwoLegged(clientId, clientSecret, [
      "bucket:read",
      "data:read",
    ]);
    console.log("🔄 Requesting 2-Legged Token (Client Credentials)...");

    const credentials = await auth.authenticate();

    console.log("✅ Connection Successful!");
    console.log(
      "🎫 Access Token acquired:",
      credentials.access_token.substring(0, 10) + "...",
    );
    console.log("expires in:", credentials.expires_in);
  } catch (error: any) {
    console.error("❌ Connection Failed!");
    console.error(
      "Error details:",
      error.response ? error.response.data : error.message,
    );
  }
}

verifyConnection();
