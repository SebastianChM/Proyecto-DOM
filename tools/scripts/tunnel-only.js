const { spawn } = require("child_process");

console.log("🚀 Iniciando Túnel Localtunnel...");
console.log("⚠️ IMPORTANTE: Autenticación vía OAuth Autodesk");
console.log(
  "   El acceso requiere login con cuenta Autodesk autorizada en ADMIN_EMAILS\n",
);

// Usar localtunnel
const tunnel = spawn("npx", ["localtunnel", "--port", "3000"], { shell: true });

tunnel.stdout.on("data", (data) => {
  const str = data.toString();
  console.log(str);

  if (str.includes("your url is:")) {
    const match = str.match(/https:\/\/[^\s]+/);
    if (match) {
      const url = match[0];
      console.log("\n🎉 ¡TÚNEL ACTIVO!");
      console.log("==================================================");
      console.log("🌍 URL DE ACCESO:", url);
      console.log("==================================================");
      console.log("\n📝 ACCESO:");
      console.log("1. Configurar CORS_ORIGINS con esta URL en .env");
      console.log("2. Autenticarse con OAuth Autodesk");
      console.log("3. Tu email debe estar en ADMIN_EMAILS para acceso admin");
      console.log("==================================================\n");
    }
  }
});

tunnel.stderr.on("data", (data) => {
  console.error("Error:", data.toString());
});

// Mantener vivo
setInterval(() => {}, 1000);
