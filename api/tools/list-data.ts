import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Users ---");
  const users = await prisma.user.findMany();
  console.table(users);

  console.log("\n--- Projects ---");
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      files: true,
    },
  });

  projects.forEach((p) => {
    console.log(`Project: ${p.name} (${p.id})`);
    console.log(`  Owner: ${p.owner?.name} (${p.ownerId})`);
    console.log(`  Files: ${p.files.length}`);
    p.files.forEach((f) => console.log(`    - ${f.name} (${f.type})`));
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
