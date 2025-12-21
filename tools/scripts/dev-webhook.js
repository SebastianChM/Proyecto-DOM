const { spawn } = require("child_process");

// Configuration
const API_PORT = 8080;

console.log(
  "\x1b[36m%s\x1b[0m",
  "🚀 Starting Professional Development Environment with Webhooks...",
);

/**
 * Helper to start ngrok
 */
function startNgrok() {
  return new Promise((resolve, reject) => {
    console.log("🔌 Starting ngrok tunnel for API...");

    // Use 'ngrok' command - assumes it's in PATH
    // We use --log=stdout --log-format=json to parse reliably, or just regex the simple output
    const ngrok = spawn(
      "ngrok",
      ["http", API_PORT.toString(), "--log=stdout"],
      { shell: true },
    );

    let urlFound = false;

    ngrok.stdout.on("data", (data) => {
      const str = data.toString();
      // console.log('[ngrok info]:', str); // Debug if needed

      // Look for URL: "url=https://xxxx.ngrok-free.app"
      const match = str.match(/url=(https:\/\/[^\s]+)/);
      if (match && !urlFound) {
        urlFound = true;
        const url = match[1];
        console.log("\x1b[32m%s\x1b[0m", `✅ Tunnel Established: ${url}`);
        resolve({ process: ngrok, url });
      }
    });

    ngrok.stderr.on("data", () => {
      // ngrok often logs to stderr for info
      // console.log('[ngrok meta]:', data.toString());
    });

    ngrok.on("error", (err) => {
      console.error("❌ Failed to start ngrok. Is it installed and in PATH?");
      reject(err);
    });

    // Timeout if no URL found
    setTimeout(() => {
      if (!urlFound) reject(new Error("Timeout waiting for ngrok URL"));
    }, 10000);
  });
}

/**
 * Main Execution
 */
async function main() {
  try {
    // 1. Start Ngrok
    let ngrokUrl;
    let ngrokProcess;

    try {
      const result = await startNgrok();
      ngrokUrl = result.url;
      ngrokProcess = result.process;
    } catch (e) {
      console.error("⚠️  Could not start ngrok:", e.message);
      console.log("👉 Application will run WITHOUT automatic webhooks.");
    }

    // 2. Prepare Environment
    const env = { ...process.env };

    if (ngrokUrl) {
      const webhookUrl = `${ngrokUrl}/api/webhooks/aps/callback`;
      env.APS_WEBHOOK_URL = webhookUrl;
      console.log("🔗 Webhook URL configured:", webhookUrl);
      console.log("   (This URL has been injected into the API environment)");
    }

    console.log("\n🔥 Launching Application (API + Frontend)...");
    console.log("==================================================");

    // 3. Start App
    // We use npm run dev which uses concurrently
    const app = spawn("npm", ["run", "dev"], {
      shell: true,
      stdio: "inherit",
      env: env,
    });

    // Handle Cleanup
    const cleanup = () => {
      if (ngrokProcess) {
        console.log("\n🛑 Stopping ngrok...");
        ngrokProcess.kill();
      }
      if (app) {
        console.log("🛑 Stopping app...");
        app.kill();
      }
      process.exit();
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("exit", cleanup);
  } catch (error) {
    console.error("Fatal Error:", error);
  }
}

main();
