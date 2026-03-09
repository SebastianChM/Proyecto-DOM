#!/usr/bin/env node
// @ts-check
"use strict";

/**
 * restore-db.js — PostgreSQL restore using pg_restore / psql
 *
 * Usage:
 *   node tools/scripts/restore-db.js <backup-file>                  # interactive confirmation
 *   node tools/scripts/restore-db.js <backup-file> --confirm        # skip interactive prompt
 *   node tools/scripts/restore-db.js <backup-file> --dry-run        # show what would run
 *   node tools/scripts/restore-db.js <backup-file> --i-know-what-i-am-doing  # required in production
 *
 * Reads DATABASE_URL from process.env (loaded from .env via dotenv if present).
 * GUARDRAILS:
 *   - Requires explicit --i-know-what-i-am-doing flag when NODE_ENV=production
 *   - Requires interactive confirmation (or --confirm flag)
 *   - Never prints passwords or full connection strings
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../..");
const DOTENV_PATH = path.join(ROOT, "apps", "api", ".env");

// ---------------------------------------------------------------------------
// Helpers (shared logic with backup-db.js kept self-contained for simplicity)
// ---------------------------------------------------------------------------

/** @param {string} msg */
function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[restore ${ts}] ${msg}`);
}

/** @param {string} msg @returns {never} */
function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/** @param {string} filepath */
function loadDotenv(filepath) {
  if (!fs.existsSync(filepath)) return;
  const lines = fs.readFileSync(filepath, "utf8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

/** @param {string | undefined} raw */
function parseDatabaseUrl(raw) {
  if (!raw)
    fail(
      "DATABASE_URL is not set. Set it in your environment or in apps/api/.env",
    );
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail("DATABASE_URL is not a valid URL");
  }
  const host = parsed.hostname;
  const port = parsed.port || "5432";
  const database = parsed.pathname.replace(/^\//, "").split("?")[0];
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  if (!host || !database || !user) {
    fail("DATABASE_URL is missing host, database, or user");
  }
  return { host, port, database, user, password };
}

/** Detect .dump (custom format) vs .sql (plain text)
 * @param {string} filepath */
function detectFormat(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === ".dump") return "custom";
  if (ext === ".sql") return "sql";
  // Try reading first bytes for pg custom format magic bytes
  const fd = fs.openSync(filepath, "r");
  const buf = Buffer.alloc(5);
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  // Custom format starts with "PGDMP"
  if (buf.toString("ascii").startsWith("PGDMP")) return "custom";
  return "sql";
}

/** Check if pg_restore / psql is available
 * @param {string} format */
function findRestoreTool(format) {
  const tool = format === "custom" ? "pg_restore" : "psql";

  // Try local
  try {
    const out = execSync(`${tool} --version`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    log(`Found local ${tool}: ${out.trim()}`);
    return { mode: "local", tool };
  } catch {
    // not in PATH
  }

  // Try docker
  const containerNames = ["dom-bim-db", "dom-bim-postgres", "postgres"];
  for (const name of containerNames) {
    try {
      const out = execSync(`docker exec ${name} ${tool} --version`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      log(`Found ${tool} via docker container '${name}': ${out.trim()}`);
      return { mode: "docker", tool, container: name };
    } catch {
      // container not available
    }
  }

  fail(
    `${tool} not found.\n` +
      "Options:\n" +
      "  1. Install PostgreSQL client tools locally\n" +
      "  2. Start the Docker postgres container (docker compose up postgres)\n" +
      "Docs: https://www.postgresql.org/download/",
  );
}

/** Ask for interactive confirmation
 * @param {string} question */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));

  const dryRun = flags.includes("--dry-run");
  const confirmed = flags.includes("--confirm");
  const prodOverride = flags.includes("--i-know-what-i-am-doing");

  // --- Validate backup file argument ---
  if (positional.length === 0) {
    console.error(
      "Usage: node tools/scripts/restore-db.js <backup-file> [--confirm] [--dry-run]",
    );
    console.error("");
    console.error("Options:");
    console.error(
      "  --confirm                   Skip interactive confirmation prompt",
    );
    console.error(
      "  --dry-run                   Show what would run without executing",
    );
    console.error(
      "  --i-know-what-i-am-doing    Required when NODE_ENV=production",
    );
    process.exit(1);
  }

  const backupFile = path.resolve(positional[0]);

  if (!fs.existsSync(backupFile)) {
    fail(`Backup file not found: ${backupFile}`);
  }

  log("Starting PostgreSQL restore...");

  // Load .env
  loadDotenv(DOTENV_PATH);

  // --- Production guardrail ---
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
  if (nodeEnv === "production" && !prodOverride) {
    fail(
      "BLOCKED: NODE_ENV=production detected.\n" +
        "Restoring in production requires the --i-know-what-i-am-doing flag.\n" +
        "This is a destructive operation that will overwrite the target database.",
    );
  }

  // Parse database URL
  const db = parseDatabaseUrl(process.env.DATABASE_URL);
  log(`Target: ${db.user}@${db.host}:${db.port}/${db.database}`);

  // Detect format
  const format = detectFormat(backupFile);
  const stats = fs.statSync(backupFile);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  log(
    `Backup file: ${path.basename(backupFile)} (${sizeMB} MB, format: ${format})`,
  );

  // --- Confirmation guardrail ---
  if (!dryRun && !confirmed) {
    console.log("");
    console.log(
      "⚠️  WARNING: This will OVERWRITE data in the target database.",
    );
    console.log(`   Database: ${db.database} on ${db.host}:${db.port}`);
    console.log(`   File:     ${path.basename(backupFile)}`);
    console.log("");
    const answer = await askConfirmation('Type "yes" to proceed: ');
    if (answer !== "yes") {
      log("Restore cancelled by user.");
      process.exit(0);
    }
  }

  // Find restore tool
  const restoreTool = findRestoreTool(format);

  if (restoreTool.mode === "docker") {
    // Docker mode: pipe file into container via local socket (no host/password)
    const container = /** @type {string} */ (restoreTool.container);
    const toolArgs =
      format === "custom"
        ? [
            restoreTool.tool,
            "-U",
            db.user,
            "-d",
            db.database,
            "--clean",
            "--if-exists",
            "--verbose",
          ]
        : [restoreTool.tool, "-U", db.user, "-d", db.database];

    const displayCmd = `docker exec -i ${container} ${toolArgs.join(" ")} < ${path.basename(backupFile)}`;
    log(`Command: ${displayCmd}`);

    if (dryRun) {
      log("DRY RUN — no restore performed");
      return;
    }

    const fileContent = fs.readFileSync(backupFile);
    const result = spawnSync("docker", ["exec", "-i", container, ...toolArgs], {
      input: fileContent,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 500 * 1024 * 1024,
    });

    // pg_restore returns non-zero on warnings too, check stderr for real errors
    const stderr = (result.stderr || "").toString().replace(db.password, "***");
    if (result.status !== 0 && !stderr.includes("WARNING")) {
      fail(`${restoreTool.tool} failed (exit ${result.status}):\n${stderr}`);
    }
    if (stderr) {
      log(
        `pg_restore output (warnings may be normal):\n${stderr.slice(0, 2000)}`,
      );
    }
  } else {
    // Local mode
    const toolArgs =
      format === "custom"
        ? [
            "-h",
            db.host,
            "-p",
            db.port,
            "-U",
            db.user,
            "-d",
            db.database,
            "--no-password",
            "--clean",
            "--if-exists",
            "--verbose",
            backupFile,
          ]
        : [
            "-h",
            db.host,
            "-p",
            db.port,
            "-U",
            db.user,
            "-d",
            db.database,
            "--no-password",
            "-f",
            backupFile,
          ];

    const tool = format === "custom" ? "pg_restore" : "psql";
    const displayCmd = `${tool} ${toolArgs.join(" ")}`;
    log(`Command: ${displayCmd}`);

    if (dryRun) {
      log("DRY RUN — no restore performed");
      return;
    }

    const result = spawnSync(tool, toolArgs, {
      env: { ...process.env, PGPASSWORD: db.password },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stderr = (result.stderr || "").toString().replace(db.password, "***");
    if (result.status !== 0 && !stderr.includes("WARNING")) {
      fail(`${tool} failed (exit ${result.status}):\n${stderr}`);
    }
    if (stderr) {
      log(`${tool} output (warnings may be normal):\n${stderr.slice(0, 2000)}`);
    }
  }

  log("---");
  log("✅ Restore completed successfully");
  log(`📁 Source: ${path.basename(backupFile)}`);
  log(`🎯 Target: ${db.user}@${db.host}:${db.port}/${db.database}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
