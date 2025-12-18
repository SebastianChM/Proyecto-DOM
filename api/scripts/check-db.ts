
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking database content...');

    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users:`);
    users.forEach(u => console.log(`- ${u.name} (${u.email}) ID: ${u.id}`));

    const projects = await prisma.project.findMany({
        include: { owner: true }
    });
    console.log(`Found ${projects.length} projects:`);
    projects.forEach(p => console.log(`- ${p.name} (Owner: ${p.owner.email}) ID: ${p.id}`));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
