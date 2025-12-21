const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const util = require("util");
const treeKill = util.promisify(require("tree-kill"));

const pidsFile = path.resolve(__dirname, "../.dev/pids.json");

const stopProcesses = async () => {
  if (fs.existsSync(pidsFile)) {
    try {
      const pids = JSON.parse(fs.readFileSync(pidsFile, "utf-8"));
      const killPromises = Object.entries(pids).map(async ([name, pid]) => {
        console.log(`Attempting to stop ${name} (PID: ${pid})...`);
        try {
          await treeKill(Number(pid), "SIGTERM");
          console.log(`✅ Stopped ${name} tree`);
        } catch (err) {
          console.error(`⚠️  Failed to stop ${name} tree:`, err);
        }
      });

      await Promise.all(killPromises);

      // Remove file ONLY after all attempts are done
      try {
        fs.unlinkSync(pidsFile);
        console.log("🧹 Cleaned up pids.json");
      } catch {
        /* ignore if already gone */
      }
    } catch (e) {
      console.error("Error reading/processing PIDs file:", e);
    }
  } else {
    console.log("ℹ️  No PIDs file found (.dev/pids.json).");
  }
};

// Wrap main logic in async execution
(async () => {
  await stopProcesses();

  console.log("📉 Stopping Infrastructure...");
  try {
    // Reuse the cross-platform wrapper logic mechanism or call it directly.
    // To be perfectly aligned, we should probably just spawn infra.js down.
    // But for "Pendiente cero", let's make sure it works as expected.
    // The simplest restart-safe way is calling the same wrapper Node script or replicating its logic.
    // Let's replicate logic to avoid spawning another node process if not strictly needed,
    // OR better, spawn the new infra.js to maintain Single Source of Truth as requested.

    const infraScript = path.resolve(__dirname, "infra.js");
    execSync(`node "${infraScript}" down`, { stdio: "inherit" });

    console.log("✅ Infrastructure stopped");
  } catch (e) {
    console.error("Error stopping docker:", e.message);
  }
})();
