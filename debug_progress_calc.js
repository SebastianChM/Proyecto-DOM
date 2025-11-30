const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllProgress() {
    console.log('Checking progress for ALL TRANSLATING files...');
    
    const files = await prisma.file.findMany({
        where: { status: 'TRANSLATING' }
    });

    for (const file of files) {
        const elapsed = Date.now() - new Date(file.updatedAt).getTime();
        const isLocal = file.apsUrn && file.apsUrn.startsWith('local-');
        const duration = isLocal ? 5000 : 60000;
        const progress = Math.min(99, Math.floor((elapsed / duration) * 100));

        console.log(`\nFile: ${file.name}`);
        console.log(`ID: ${file.id}`);
        console.log(`UpdatedAt: ${file.updatedAt}`);
        console.log(`Elapsed: ${elapsed}ms`);
        console.log(`Duration: ${duration}ms`);
        console.log(`Calculated Progress: ${progress}%`);
    }
}

checkAllProgress()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
