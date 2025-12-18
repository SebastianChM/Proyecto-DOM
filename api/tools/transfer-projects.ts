import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function transferProjects() {
  // Encontrar el usuario temporal y tu usuario
  const tempUser = await prisma.user.findUnique({
    where: { email: "temp@example.com" },
  });

  const sebastianUser = await prisma.user.findUnique({
    where: { email: "sebastian.chirino@dom.com" },
  });

  if (!tempUser || !sebastianUser) {
    console.log("❌ Usuario no encontrado");
    return;
  }

  console.log(
    `\n🔄 Transfiriendo proyectos de ${tempUser.email} a ${sebastianUser.email}...\n`,
  );

  // Transferir todos los proyectos
  const result = await prisma.project.updateMany({
    where: { ownerId: tempUser.id },
    data: { ownerId: sebastianUser.id },
  });

  console.log(`✅ ${result.count} proyectos transferidos exitosamente`);

  // Mostrar los proyectos transferidos
  const projects = await prisma.project.findMany({
    where: { ownerId: sebastianUser.id },
    include: { files: true },
  });

  console.log("\n📁 Proyectos ahora en tu cuenta:\n");
  projects.forEach((p) => {
    console.log(`  - ${p.name} (${p.files.length} archivos)`);
  });

  await prisma.$disconnect();
}

transferProjects().catch(console.error);
