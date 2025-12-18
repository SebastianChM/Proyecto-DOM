const { spawn } = require("child_process");

// Detect Platform
const isWin = process.platform === "win32";

const script = isWin ? "scripts\\infra.bat" : "scripts/infra.sh";
const cmd = isWin ? script : "bash";

// Handle custom "reset" command
const inputArgs = process.argv.slice(2);
if (inputArgs[0] === "reset") {
  console.log("🔄 Executing Infra Reset (Down -v + Up -d)...");

  // We run down -v, then up -d sequentially
  try {
    runInfra(["down", "-v"]);
    runInfra(["up", "-d"]);
    console.log("✅ Infra reset complete (Volumes wiped & Restarted)");
    process.exit(0);
  } catch (e) {
    console.error("❌ Reset failed:", e.message);
    process.exit(1);
  }
} else {
  // Passthrough normal commands
  const args = isWin ? inputArgs : [script, ...inputArgs];
  spawnInfra(cmd, args);
}

function runInfra(args) {
  const finalArgs = isWin ? args : [script, ...args];
  const result = require("child_process").spawnSync(cmd, finalArgs, {
    stdio: "inherit",
    shell: isWin,
  });
  if (result.status !== 0)
    throw new Error(`Command failed with code ${result.status}`);
}

function spawnInfra(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWin,
  });
  child.on("close", (code) => process.exit(code));
  child.on("error", (err) => {
    console.error("❌ Infra Execution Failed:", err);
    process.exit(1);
  });
}
