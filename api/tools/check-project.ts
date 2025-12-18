import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projectId = "bfa34ec4-d45d-44a7-99ed-05d4e5e2a550";

  console.log(`Searching for project: ${projectId}`);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      files: true,
      owner: true,
      members: true,
    },
  });

  if (project) {
    console.log("✅ Project found:");
    console.log(`  Name: ${project.name}`);
    console.log(`  Owner: ${project.owner.name} (${project.owner.id})`);
    console.log(`  Files: ${project.files.length}`);
    console.log(`  Members: ${project.members.length}`);
    console.log(`  Created: ${project.createdAt}`);
    console.log("\nFull project data:", JSON.stringify(project, null, 2));
  } else {
    console.log("❌ Project NOT found in database");

    // List all projects to see what's available
    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    });

    console.log("\nAll available projects:");
    allProjects.forEach((p) => {
      console.log(`  - ${p.name} (${p.id}) - Owner: ${p.ownerId}`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
