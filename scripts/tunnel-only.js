
const { spawn } = require('child_process');
const fs = require('fs');

console.log("🚀 Iniciando Túnel Localtunnel (Solo Túnel)...");

// Usar localtunnel
const tunnel = spawn('npx', ['localtunnel', '--port', '3000'], { shell: true });

tunnel.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(str);

    if (str.includes('your url is:')) {
        const match = str.match(/https:\/\/[^\s]+/);
        if (match) {
            const url = match[0];
            console.log("\n🎉 ¡SISTEMA ONLINE!");
            console.log("==================================================");
            console.log("🌍 LINK DE ACCESO:", url);
            console.log("👤 USUARIO: admin");
            console.log("🔑 CONTRASEÑA: dom-secure-2024");
            console.log("==================================================");
            console.log("\n📝 IMPORTANTE:");
            console.log("1. Si pide 'Tunnel Password', usa tu IP pública.");
            console.log("==================================================\n");

            fs.writeFileSync('remote-access-info.txt', `LINK: ${url}`);
        }
    }
});

tunnel.stderr.on('data', (data) => {
    console.error('Error:', data.toString());
});

// Mantener vivo
setInterval(() => { }, 1000);
