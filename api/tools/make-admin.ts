/**
 * 🔑 Script para Asignar Rol ADMIN
 *
 * Uso: npx ts-node scripts/make-admin.ts <email>
 * Ejemplo: npx ts-node scripts/make-admin.ts sebastian@dom.com
 */

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const prisma = new PrismaClient();

async function makeAdmin(email: string) {
  try {
    console.log(`🔍 Buscando usuario: ${email}...`);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.error(`❌ Usuario no encontrado: ${email}`);
      console.log("\n💡 Usuarios disponibles:");
      const allUsers = await prisma.user.findMany({
        select: { email: true, name: true, role: true },
      });
      allUsers.forEach((u) => {
        console.log(`   - ${u.email} (${u.name}) - Rol actual: ${u.role}`);
      });
      process.exit(1);
    }

    if (user.role === "ADMIN") {
      console.log(`ℹ️  El usuario ${email} ya es ADMIN`);
      process.exit(0);
    }

    console.log(`✅ Usuario encontrado: ${user.name} (${user.email})`);
    console.log(`📝 Rol actual: ${user.role}`);
    console.log(`🔄 Cambiando rol a ADMIN...`);

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });

    console.log(`✅ ¡Listo! ${user.name} ahora es ADMIN`);
    console.log(`\n🔗 Puede acceder al panel admin en: /dashboard/sys/acl`);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Obtener email del argumento
const email = process.argv[2];

if (!email) {
  console.error("❌ Error: Debes proporcionar un email");
  console.log("\n📖 Uso:");
  console.log("   npx ts-node scripts/make-admin.ts <email>");
  console.log("\n📝 Ejemplo:");
  console.log("   npx ts-node scripts/make-admin.ts sebastian@dom.com");
  process.exit(1);
}

makeAdmin(email);
