const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const projectCount = await prisma.project.count();
    const fileCount = await prisma.file.count();
    const userCount = await prisma.user.count();

    console.log("=== DATABASE STATUS ===");
    console.log("Users:", userCount);
    console.log("Projects:", projectCount);
    console.log("Files:", fileCount);

    if (projectCount === 0) {
      console.log("\n⚠️  No projects found! Database is empty.");
    } else {
      const projects = await prisma.project.findMany({
        include: {
          _count: {
            select: { files: true },
          },
        },
      });
      console.log("\nProjects:");
      projects.forEach((p) => {
        console.log(`  - ${p.name} (${p._count.files} files)`);
      });
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
