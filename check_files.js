const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const files = await prisma.file.findMany({
    include: { project: true }
  });
  console.log('--- Current Files in DB ---');
  files.forEach(f => {
    console.log(`ID: ${f.id}`);
    console.log(`Name: ${f.name}`);
    console.log(`Status: ${f.status}`);
    console.log(`APS URN: ${f.apsUrn}`);
    console.log(`Project: ${f.project.name}`);
    console.log('---------------------------');
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
