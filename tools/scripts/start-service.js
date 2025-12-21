const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const args = process.argv.slice(2);
const name = args[0];
const cmd = args[1];
const cmdArgs = args.slice(2);

if (!name || !cmd) {
  console.error("Usage: node start-service.js <name> <command> [args...]");
  process.exit(1);
}

const pidsFile = path.resolve(__dirname, "../.dev/pids.json");

// Handle Windows npm behavior
// npm on windows is npm.cmd
const finalCmd =
  process.platform === "win32" && cmd === "npm" ? "npm.cmd" : cmd;

console.log(`🚀 [${name}] Starting: ${finalCmd} ${cmdArgs.join(" ")}`);

// Use spawn without shell: true to keep process tree clean and manageable
// We pass stdio: inherit to see output in main console
const child = spawn(finalCmd, cmdArgs, {
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "true" },
});

const pidsDir = path.dirname(pidsFile);
if (!fs.existsSync(pidsDir)) {
  fs.mkdirSync(pidsDir, { recursive: true });
}

// Save PID to file for stop-dev.js
let pids = {};
if (fs.existsSync(pidsFile)) {
  try {
    pids = JSON.parse(fs.readFileSync(pidsFile, "utf-8"));
  } catch {
    // failed to write pid
  }
}
pids[name] = child.pid;
fs.writeFileSync(pidsFile, JSON.stringify(pids, null, 2));

child.on("exit", (code) => {
  console.log(`[${name}] Exited with code ${code}`);
});

child.on("error", (err) => {
  console.error(`[${name}] Failed to start: ${err.message}`);
});
