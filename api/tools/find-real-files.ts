import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Finding Real BIM Files (Non-Mock) ---");

  const realFiles = await prisma.file.findMany({
    where: {
      AND: [
        { status: "READY" },
        { apsUrn: { not: null } },
        { apsUrn: { not: { startsWith: "local-" } } },
        { type: { in: ["RVT", "IFC"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      type: true,
      apsUrn: true,
      status: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 10,
  });

  console.log(`\nFound ${realFiles.length} real BIM files:\n`);

  realFiles.forEach((f) => {
    console.log(`File: ${f.name} (${f.type})`);
    console.log(`  Project: ${f.project.name}`);
    console.log(`  URN: ${f.apsUrn}`);
    console.log(
      `  Viewer URL: http://localhost:3000/dashboard/viewer?urn=${f.apsUrn}`,
    );
    console.log("");
  });

  if (realFiles.length === 0) {
    console.log(
      "⚠️  No real BIM files found. All files appear to be mock/local files.",
    );
    console.log(
      "To test the 3D viewer properly, you need to upload a real file from Autodesk.",
    );
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
