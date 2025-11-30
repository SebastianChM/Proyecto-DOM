const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMissingUrns() {
    console.log('--- Fixing Files with Missing URNs ---');

    const files = await prisma.file.findMany({
        where: { apsUrn: null }
    });

    if (files.length === 0) {
        console.log('No files with missing URNs found.');
        return;
    }

    for (const file of files) {
        console.log(`Fixing file: ${file.name} (ID: ${file.id})`);
        
        // Generate a mock URN
        const mockUrn = `local-fixed-${Date.now()}-${Buffer.from(file.name).toString('base64').replace(/=/g, '')}`;
        
        await prisma.file.update({
            where: { id: file.id },
            data: { apsUrn: mockUrn }
        });
        
        console.log(`✅ Assigned mock URN: ${mockUrn}`);
    }
    
    console.log('\nAll files fixed. You can now try "Start Translation" again.');
}

fixMissingUrns()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
