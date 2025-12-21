const fs = require("fs");
const path = require("path");

// List of files that define Hito 0
const filesToPack = [
  "package.json",
  "docker-compose.dev.yml",
  ".env.example",
  ".gitignore",
  "eslint.config.mjs",
  "docs/setup/HITO0.md",
  "scripts/gen-frontend-env.js",
  "scripts/start-service.js",
  "scripts/stop-dev.js",
  "scripts/infra.js",
  "scripts/infra.bat",
  "scripts/infra.sh",
  "scripts/infra-status.js",
  ".gitattributes",
  ".husky/pre-commit",
  "api/package.json",
  "api/tsconfig.json",
  "api/src/config/env.ts",
  "api/src/config/cors.config.ts",
  "api/src/index.ts",
  "api/src/worker.ts",
  "api/src/lib/prisma.ts",
  "api/src/routes/health.ts",
  "api/src/global.d.ts",
];

const OUTPUT_FILE = "HITO0_CONTEXT.md";
const rootDir = path.resolve(__dirname, "..");

console.log(`📦 Generating Hito 0 Context...`);

let output = `# Hito 0: Contexto Completo\n\n`;
output += `> Generated on: ${new Date().toISOString()}\n`;
output += `> Purpose: Aggregated codebase snapshot for LLM Context / Documentation.\n\n`;

let validCount = 0;

filesToPack.forEach((relPath) => {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`   + Including: ${relPath}`);
    const content = fs.readFileSync(fullPath, "utf-8").trimEnd();
    // Simple extension detection
    let ext = path.extname(fullPath).substring(1);
    if (ext === "js" || ext === "mjs") ext = "javascript";
    if (ext === "ts") ext = "typescript";
    if (ext === "yml") ext = "yaml";
    if (ext === "sh") ext = "bash";
    if (ext === "bat") ext = "batch";
    if (ext === "md") ext = "markdown";
    if (!ext) ext = "text";

    output += `## File: ${relPath}\n\n`;
    output += `\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
    output += `---\n\n`;
    validCount++;
  } else {
    console.warn(`   ! MISSING: ${relPath}`);
    output += `## File: ${relPath}\n\n*File not found during aggregation*\n\n---\n\n`;
  }
});

const outputPath = path.join(rootDir, OUTPUT_FILE);
fs.writeFileSync(outputPath, output);

console.log(
  `\n✅ Successfully aggregated ${validCount} files into ${OUTPUT_FILE}`,
);
console.log(`   Path: ${outputPath}`);
