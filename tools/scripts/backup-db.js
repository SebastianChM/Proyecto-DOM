#!/usr/bin/env node
// @ts-check
"use strict";

/**
 * backup-db.js — PostgreSQL backup using pg_dump
 *
 * Usage:
 *   node tools/scripts/backup-db.js                  # backup using DATABASE_URL from .env
 *   node tools/scripts/backup-db.js --dry-run        # show what would run without executing
 *   node tools/scripts/backup-db.js --format=sql     # plain SQL instead of custom format
 *
 * Reads DATABASE_URL from process.env (loaded from .env via dotenv if present).
 * Generates timestamped dump files in storage/backups/.
 * Never prints passwords or full connection strings.
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../..");
const BACKUP_DIR = path.join(ROOT, "storage", "backups");
const DOTENV_PATH = path.join(ROOT, "apps", "api", ".env");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {string} msg */
function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[backup ${ts}] ${msg}`);
}

/** @param {string} msg @returns {never} */
function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/** Load .env file manually (no dependency required)
 * @param {string} filepath */
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
    // Strip surrounding quotes
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

/** Parse DATABASE_URL into components (never returns password in output)
 * @param {string | undefined} raw */
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

/** Check if a command exists (local PATH or docker) */
function findPgDump() {
  // Try local
  try {
    const out = execSync("pg_dump --version", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    log(`Found local pg_dump: ${out.trim()}`);
    return { mode: "local" };
  } catch {
    // not in PATH
  }

  // Try docker container
  const containerNames = ["dom-bim-db", "dom-bim-postgres", "postgres"];
  for (const name of containerNames) {
    try {
      const out = execSync(`docker exec ${name} pg_dump --version`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      log(`Found pg_dump via docker container '${name}': ${out.trim()}`);
      return { mode: "docker", container: name };
    } catch {
      // container not available
    }
  }

  fail(
    "pg_dump not found.\n" +
      "Options:\n" +
      "  1. Install PostgreSQL client tools (pg_dump) locally\n" +
      "  2. Start the Docker postgres container (docker compose up postgres)\n" +
      "Docs: https://www.postgresql.org/download/",
  );
}

/** Build pg_dump command args
 * @param {{host: string, port: string, database: string, user: string}} db
 * @param {string} format
 * @param {string} mode */
function buildPgDumpArgs(db, format, mode) {
  const args =
    mode === "docker"
      ? ["-U", db.user, "-d", db.database, "--verbose"]
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
          "--verbose",
        ];

  if (format === "sql") {
    args.push("--clean", "--if-exists");
  } else {
    args.push("--format=custom", "--compress=6");
  }

  return args;
}

/** Generate output filename
 * @param {string} database
 * @param {string} format */
function buildOutputPath(database, format) {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const ext = format === "sql" ? "sql" : "dump";
  return path.join(BACKUP_DIR, `${database}_${ts}.${ext}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const format = args.includes("--format=sql") ? "sql" : "custom";

  log("Starting PostgreSQL backup...");

  // Load .env
  loadDotenv(DOTENV_PATH);

  // Parse database URL
  const db = parseDatabaseUrl(process.env.DATABASE_URL);
  log(`Target: ${db.user}@${db.host}:${db.port}/${db.database}`);

  // Ensure backup dir
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Find pg_dump
  const pgDump = findPgDump();

  // Build command
  const pgArgs = buildPgDumpArgs(db, format, pgDump.mode);
  const outputPath = buildOutputPath(db.database, format);

  if (pgDump.mode === "docker") {
    // Docker: use local socket (no host/password needed inside the postgres container)
    const container = /** @type {string} */ (pgDump.container);
    const dockerArgs = ["docker", "exec", container, "pg_dump", ...pgArgs];
    const displayCmd = dockerArgs.join(" ");
    log(`Command: ${displayCmd} > ${path.basename(outputPath)}`);

    if (dryRun) {
      log("DRY RUN — no backup created");
      log(`Would write to: ${outputPath}`);
      return;
    }

    const realDockerArgs = ["exec", container, "pg_dump", ...pgArgs];

    const result = spawnSync("docker", realDockerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 500 * 1024 * 1024, // 500 MB
    });

    if (result.status !== 0) {
      const stderr = (result.stderr || "")
        .toString()
        .replace(db.password, "***");
      fail(`pg_dump failed (exit ${result.status}):\n${stderr}`);
    }

    fs.writeFileSync(outputPath, result.stdout);
  } else {
    // Local pg_dump
    const fileArgs = [...pgArgs, `--file=${outputPath}`];
    const displayCmd = `pg_dump ${fileArgs.join(" ")}`;
    log(`Command: ${displayCmd}`);

    if (dryRun) {
      log("DRY RUN — no backup created");
      log(`Would write to: ${outputPath}`);
      return;
    }

    const result = spawnSync("pg_dump", fileArgs, {
      env: { ...process.env, PGPASSWORD: db.password },
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.status !== 0) {
      const stderr = (result.stderr || "")
        .toString()
        .replace(db.password, "***");
      fail(`pg_dump failed (exit ${result.status}):\n${stderr}`);
    }
  }

  // Verify output
  if (!fs.existsSync(outputPath)) {
    fail("Backup file was not created");
  }

  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  log("---");
  log("✅ Backup completed successfully");
  log(`📁 File: ${path.relative(ROOT, outputPath)}`);
  log(`📊 Size: ${sizeMB} MB`);
  log(`📦 Format: ${format === "sql" ? "Plain SQL" : "Custom (pg_restore)"}`);
}

main();
