const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load root .env
const rootEnvPath = path.resolve(__dirname, "../.env");
const frontendEnvPath = path.resolve(__dirname, "../frontend/.env.local");

console.log(`[Sync] Reading from ${rootEnvPath}`);

if (!fs.existsSync(rootEnvPath)) {
  console.warn("⚠️  Root .env file not found. Skipping auto-sync.");
  process.exit(0);
}

const config = dotenv.config({ path: rootEnvPath }).parsed || {};

// Validate NEXT_PUBLIC_API_BASE_URL
const apiBaseUrl = config["NEXT_PUBLIC_API_BASE_URL"];
if (!apiBaseUrl) {
  console.error("❌ Error: NEXT_PUBLIC_API_BASE_URL is missing in root .env");
  process.exit(1);
}

try {
  new URL(apiBaseUrl);
} catch {
  console.error(
    `❌ Error: NEXT_PUBLIC_API_BASE_URL is not a valid URL: "${apiBaseUrl}"`,
  );
  process.exit(1);
}

const publicVars = Object.keys(config)
  .filter((k) => k.startsWith("NEXT_PUBLIC_"))
  .map((k) => `${k}="${config[k]}"`)
  .join("\n");

fs.writeFileSync(
  frontendEnvPath,
  `# Auto-generated from root .env\n${publicVars}`,
);

const publicCount = publicVars.split("\n").filter((l) => l.trim()).length;
console.log(`✅ Synced ${publicCount} vars to frontend/.env.local`);
