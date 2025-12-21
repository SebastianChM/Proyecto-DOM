const http = require("http");
const { execSync } = require("child_process");

console.log("🐳 Checking Docker Status...");
try {
  execSync("docker ps", { stdio: "inherit" });
} catch {
  console.error("❌ Docker check failed. Is Docker running?");
  process.exit(1);
}

console.log("\n❤️  Checking API Health...");
const options = {
  hostname: "localhost",
  port: 8080,
  path: "/health",
  method: "GET",
  timeout: 2000, // 2 seconds timeout
};

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    console.log(`SC: ${res.statusCode}`);
    console.log(`Body: ${data}`);
    if (res.statusCode === 200) {
      console.log("✅ API Online");
      process.exit(0);
    } else {
      console.log("⚠️ API returned non-200 status");
      process.exit(1);
    }
  });
});

req.on("error", (e) => {
  console.error(`❌ API Health Check Failed: ${e.message}`);
  console.log("   (Is the API server running?)");
  process.exit(1);
});

req.on("timeout", () => {
  req.destroy();
  console.error("❌ API Health Check Timed Out");
  process.exit(1);
});

req.end();
