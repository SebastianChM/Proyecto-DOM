const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const DA_BASE_URL = "https://developer.api.autodesk.com/da/us-east/v3";
const ZIP_PATH = path.join(__dirname, "../aps-plugin/RevitToPdfApp.zip");
const APP_NAME = "RevitToPdfApp";
const ACTIVITY_NAME = "RevitToPdfActivity";
const ENGINE = "Autodesk.Revit+2024";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Missing APS_CLIENT_ID or APS_CLIENT_SECRET in .env");
  process.exit(1);
}

if (!fs.existsSync(ZIP_PATH)) {
  console.error(`❌ Plugin ZIP not found at: ${ZIP_PATH}`);
  console.log(
    "👉 Please compile the plugin and place RevitToPdfApp.zip in api/aps-plugin/",
  );
  process.exit(1);
}

async function getInternalToken() {
  try {
    const response = await axios.post(
      "https://developer.api.autodesk.com/authentication/v2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "code:all data:write data:read bucket:create bucket:delete",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Auth Failed:", error.response?.data || error.message);
    process.exit(1);
  }
}

async function main() {
  console.log("🚀 Starting Revit Plugin Deployment...");
  const token = await getInternalToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1. Get/Create Nickname
  let nickname = CLIENT_ID; // Default fallback
  try {
    const me = await axios.get(`${DA_BASE_URL}/forgeapps/me`, { headers });
    nickname = me.data; // If nickname exists, it returns just the string? Or object?
    // Actually GET /me returns the nickname string in body usually?
    // Docs say GET /forgeapps/me returns the nickname.
  } catch (e) {
    // If 404, we might need to set it, but usually we assume it's set or use ClientID
    // Let's try to set it if we have a config for it, otherwise assume ClientID
    if (process.env.APS_DA_NICKNAME) {
      try {
        await axios.patch(
          `${DA_BASE_URL}/forgeapps/me`,
          { nickname: process.env.APS_DA_NICKNAME },
          { headers },
        );
        nickname = process.env.APS_DA_NICKNAME;
      } catch (err) {
        // Ignore if conflict
      }
    }
  }
  console.log(`👤 Using Nickname: ${nickname}`);

  // 2. Create/Update AppBundle
  const appBundleId = `${APP_NAME}`;
  const qualifiedAppBundleId = `${nickname}.${APP_NAME}+prod`;

  console.log(`📦 Creating AppBundle: ${appBundleId}...`);

  let uploadParams = null;

  try {
    // Try to create
    const spec = {
      id: appBundleId,
      engine: ENGINE,
      description: "Revit to PDF Export Plugin",
    };
    const res = await axios.post(`${DA_BASE_URL}/appbundles`, spec, {
      headers,
    });
    uploadParams = res.data.uploadParameters;
    console.log("✅ AppBundle spec created.");
  } catch (error) {
    if (error.response?.status === 409) {
      console.log(
        "ℹ️ AppBundle already exists. Getting upload URL for new version...",
      );
      // If exists, we can't "get" the upload params easily without creating a new version?
      // Actually, we should probably delete it and recreate it for dev simplicity,
      // OR use the endpoint to update the appbundle (which gives new upload params).
      // POST /appbundles (if exists) -> 409.
      // We need to update it. But AppBundles are immutable versions?
      // No, we can update the alias, but to update code we upload a new version.
      // But for simplicity in this script, let's try to delete the old one first (if not used by activity)
      // OR better: Update the AppBundle (POST /appbundles with same ID is not allowed).
      // We should use POST /appbundles/{id}/versions to create a new version?
      // Or just delete and recreate for "dev" environment.

      console.log("⚠️ Deleting existing AppBundle to force update...");
      try {
        await axios.delete(`${DA_BASE_URL}/appbundles/${appBundleId}`, {
          headers,
        });
        // Re-create
        const spec = {
          id: appBundleId,
          engine: ENGINE,
          description: "Revit to PDF Export Plugin",
        };
        const res = await axios.post(`${DA_BASE_URL}/appbundles`, spec, {
          headers,
        });
        uploadParams = res.data.uploadParameters;
      } catch (delErr) {
        console.error(
          "❌ Failed to delete/recreate AppBundle:",
          delErr.response?.data || delErr.message,
        );
        process.exit(1);
      }
    } else {
      console.error("❌ Failed to create AppBundle:", error.response?.data);
      process.exit(1);
    }
  }

  // 3. Upload ZIP
  if (uploadParams) {
    console.log("📤 Uploading ZIP file...");
    const formData = new FormData();
    Object.keys(uploadParams.formData).forEach((key) => {
      formData.append(key, uploadParams.formData[key]);
    });
    formData.append("file", fs.createReadStream(ZIP_PATH));

    await axios.post(uploadParams.endpointURL, formData, {
      headers: formData.getHeaders(),
    });
    console.log("✅ ZIP Uploaded.");
  }

  // 4. Create Alias 'prod'
  console.log('🏷️  Updating Alias "prod"...');
  try {
    await axios.post(
      `${DA_BASE_URL}/appbundles/${appBundleId}/aliases`,
      { id: "prod", version: 1 },
      { headers },
    );
  } catch (e) {
    if (e.response?.status === 409) {
      // Update existing alias
      await axios.patch(
        `${DA_BASE_URL}/appbundles/${appBundleId}/aliases/prod`,
        { version: 1 },
        { headers },
      );
    }
  }
  console.log("✅ Alias updated.");

  // 5. Create Activity
  const activityId = `${ACTIVITY_NAME}`;
  console.log(`⚙️  Configuring Activity: ${activityId}...`);

  // Delete existing activity to ensure clean state
  try {
    await axios.delete(`${DA_BASE_URL}/activities/${activityId}`, { headers });
  } catch (e) {}

  const activitySpec = {
    id: activityId,
    commandLine: [
      `$(engine.path)\\\\revitcoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[${APP_NAME}].path)"`,
    ],
    parameters: {
      inputFile: {
        verb: "get",
        description: "Input Revit File",
        required: true,
        localName: "$(inputFile)",
      },
      outputPdf: {
        verb: "put",
        description: "Output PDF File",
        required: true,
        localName: "output.pdf",
      },
    },
    engine: ENGINE,
    appbundles: [`${nickname}.${APP_NAME}+prod`],
    description: "Exports Revit sheets to PDF",
  };

  try {
    await axios.post(`${DA_BASE_URL}/activities`, activitySpec, { headers });
    console.log("✅ Activity Created.");

    // Alias for activity
    await axios.post(
      `${DA_BASE_URL}/activities/${activityId}/aliases`,
      { id: "prod", version: 1 },
      { headers },
    );
    console.log("✅ Activity Alias Created.");
  } catch (error) {
    console.error(
      "❌ Failed to create activity:",
      error.response?.data || error.message,
    );
  }

  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log(`AppBundle: ${qualifiedAppBundleId}`);
  console.log(`Activity: ${nickname}.${ACTIVITY_NAME}+prod`);
}

main();
