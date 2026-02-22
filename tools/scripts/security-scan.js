#!/usr/bin/env node
/**
 * Security Scanner Script
 *
 * Scans the codebase for potential security issues:
 * - Hardcoded credentials
 * - Exposed secrets
 * - Sensitive patterns
 *
 * Used by:
 * - CI/CD pipeline (.github/workflows/ci.yml)
 * - Pre-commit hook (.husky/pre-commit)
 */

const fs = require("fs");
const path = require("path");

// Patterns that indicate potential security issues
const SECURITY_PATTERNS = [
  // API Keys and Secrets
  {
    pattern: /APS_CLIENT_SECRET\s*=\s*[A-Za-z0-9]{20,}/g,
    name: "APS Client Secret",
  },
  {
    pattern: /APS_CLIENT_ID\s*=\s*[A-Za-z0-9]{20,}/g,
    name: "APS Client ID (if not placeholder)",
  },
  {
    pattern: /password\s*[:=]\s*["'][^"']{8,}["']/gi,
    name: "Hardcoded password",
  },
  { pattern: /secret\s*[:=]\s*["'][^"']{16,}["']/gi, name: "Hardcoded secret" },
  { pattern: /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi, name: "API Key" },
  {
    pattern: /bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
    name: "Bearer Token",
  },

  // Database URLs with credentials
  {
    pattern: /postgresql:\/\/[^:]+:[^@]+@/g,
    name: "PostgreSQL URL with password",
  },
  {
    pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g,
    name: "MongoDB URL with password",
  },
  { pattern: /redis:\/\/:[^@]+@/g, name: "Redis URL with password" },

  // AWS/Cloud credentials
  { pattern: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key ID" },
  {
    pattern: /aws_secret_access_key\s*=\s*[A-Za-z0-9\/+=]{40}/gi,
    name: "AWS Secret Key",
  },

  // Private keys
  {
    pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
    name: "Private Key",
  },
  { pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g, name: "SSH Private Key" },
];

// Files and directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /coverage\//,
  /\.env\.example$/,
  /security-scan\.js$/, // Skip self
  /\.lock$/,
  /package-lock\.json$/,
  /\.min\.js$/,
  /\.map$/,
  /uploads\//, // Skip uploaded files
  /downloads\//, // Skip downloaded files
  /tests[\/\\]/, // Skip test files (contain mock secrets)
  /\.test\.(js|ts)$/, // Skip test files
  /\.spec\.(js|ts)$/, // Skip spec files
  /setup\.ts$/, // Skip test setup
  // Skip gitignored documentation folders (contain examples and AI context)
  /docs[\/\\]context\//,
  /docs[\/\\]hitos\//,
  /docs[\/\\]guides\//,
  /docs[\/\\]plans\//,
  /_CONTEXT\.md$/,
  /_EVIDENCE\.md$/,
];

// File extensions to scan
const SCAN_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".txt",
  ".env",
  ".sh",
  ".ps1",
];

let issuesFound = 0;
let filesScanned = 0;

/**
 * Check if a file should be skipped
 */
function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Check if a file should be scanned based on extension
 */
function shouldScan(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SCAN_EXTENSIONS.includes(ext) || filePath.endsWith(".env");
}

/**
 * Scan a single file for security issues
 */
function scanFile(filePath) {
  if (shouldSkip(filePath) || !shouldScan(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    filesScanned++;

    SECURITY_PATTERNS.forEach(({ pattern, name }) => {
      // Reset regex state
      pattern.lastIndex = 0;

      lines.forEach((line, lineNum) => {
        // Skip comments and example files
        if (line.trim().startsWith("//") && line.includes("example")) return;
        if (line.trim().startsWith("#") && line.includes("example")) return;

        // Skip placeholder patterns (documentation examples)
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("placeholder")) return;
        if (lowerLine.includes("<your_") || lowerLine.includes("your_")) return;
        if (lowerLine.includes("redacted")) return;
        if (lowerLine.includes("changeme") || lowerLine.includes("change_me"))
          return;
        if (
          lowerLine.includes("your_password") ||
          lowerLine.includes("your-password")
        )
          return;
        if (
          lowerLine.includes("password_here") ||
          lowerLine.includes("secret_here")
        )
          return;
        if (
          lowerLine.includes("user:password") ||
          lowerLine.includes("user:pass@")
        )
          return;
        if (lowerLine.includes("postgres:postgres@")) return; // Default test credentials
        if (lowerLine.includes("mock_") || lowerLine.includes("test_")) return;
        if (
          lowerLine.includes("example.com") ||
          lowerLine.includes("localhost")
        )
          return;
        if (lowerLine.includes("_at_least_") || lowerLine.includes("_minimum_"))
          return;
        if (lowerLine.includes("test-secret")) return; // Test fallback defaults
        if (
          lowerLine.includes("generate_random") ||
          lowerLine.includes("<generate_")
        )
          return;
        if (lowerLine.includes("_chars_") || lowerLine.includes("_chars>"))
          return;

        if (pattern.test(line)) {
          issuesFound++;
          console.error(`\n❌ SECURITY ISSUE: ${name}`);
          console.error(`   File: ${filePath}`);
          console.error(`   Line: ${lineNum + 1}`);
          console.error(
            `   Content: ${line.substring(0, 80)}${line.length > 80 ? "..." : ""}`,
          );
        }
        pattern.lastIndex = 0; // Reset for next line
      });
    });
  } catch (err) {
    // Skip files that can't be read
    if (err.code !== "ENOENT" && err.code !== "EISDIR") {
      console.warn(`Warning: Could not read ${filePath}: ${err.message}`);
    }
  }
}

/**
 * Recursively scan a directory
 */
function scanDirectory(dirPath) {
  if (shouldSkip(dirPath)) return;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        scanFile(fullPath);
      }
    }
  } catch (err) {
    // Skip directories that can't be read
  }
}

/**
 * Main execution
 */
function main() {
  console.log("🔍 Security Scan Starting...\n");
  console.log("Scanning for:");
  SECURITY_PATTERNS.forEach((p) => console.log(`  - ${p.name}`));
  console.log("");

  const rootDir = process.cwd();

  // Scan main directories
  const dirsToScan = ["apps", "packages", "tools", "docs", "infra", "scripts"];

  // Also scan root-level files
  try {
    const rootFiles = fs.readdirSync(rootDir, { withFileTypes: true });
    rootFiles.forEach((entry) => {
      if (entry.isFile()) {
        scanFile(path.join(rootDir, entry.name));
      }
    });
  } catch (err) {
    // Ignore
  }

  // Scan directories
  dirsToScan.forEach((dir) => {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath)) {
      scanDirectory(fullPath);
    }
  });

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 Scan Complete`);
  console.log(`   Files scanned: ${filesScanned}`);
  console.log(`   Issues found: ${issuesFound}`);
  console.log(`${"=".repeat(50)}\n`);

  if (issuesFound > 0) {
    console.error("❌ Security scan FAILED. Please fix the issues above.");
    console.error(
      "   Remove or replace hardcoded credentials with environment variables.\n",
    );
    process.exit(1);
  } else {
    console.log("✅ Security scan PASSED. No issues found.\n");
    process.exit(0);
  }
}

main();
