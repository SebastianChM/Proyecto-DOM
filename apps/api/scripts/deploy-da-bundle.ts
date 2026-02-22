/**
 * APS AppBundle Deployment Script
 * Usage: npm run deploy-bundle -- ./path/to/bundle.zip
 */

import { designAutomationService } from "../src/services/aps/design-automation.service";
import path from "path";
import fs from "fs";

// Load env vars if running directly
import dotenv from "dotenv";
dotenv.config();

const run = async () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("❌ Usage: ts-node deploy-da-bundle.ts <path-to-zip>");
    process.exit(1);
  }

  const zipPath = path.resolve(args[0]);

  if (!fs.existsSync(zipPath)) {
    console.error(`❌ File not found: ${zipPath}`);
    process.exit(1);
  }

  console.log(`📦 Deploying ${path.basename(zipPath)}...`);

  try {
    // Hardcoded "RevitToPdfApp" as per PackageContents.xml
    const appName = "RevitToPdfApp";
    const engine = "Autodesk.Revit+2024";
    const description = "Exports Revit Sheets to PDF";

    await designAutomationService.deployAppBundle(
      appName,
      zipPath,
      engine,
      description,
    );

    console.log("✅ DEPLOYMENT SUCCESSFUL!");
  } catch (error) {
    console.error("❌ Deployment Failed:", error);
    process.exit(1);
  }
};

run();
