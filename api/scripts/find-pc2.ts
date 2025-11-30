
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findFile() {
    try {
        const files = await prisma.file.findMany({
            where: {
                name: {
                    contains: 'PC2'
                }
            }
        });

        if (files.length > 0) {
            console.log(`✅ Found ${files.length} files matching 'PC2':`);
            files.forEach(f => {
                console.log(`- Name: ${f.name}`);
                console.log(`  ID: ${f.id}`);
                console.log(`  URN: ${f.apsUrn}`);
                console.log(`  Status: ${f.status}`);
            });
        } else {
            console.log('❌ No file found matching "PC2". Listing all recent files...');
            const recent = await prisma.file.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' }
            });
            recent.forEach(f => {
                console.log(`- ${f.name} (${f.id})`);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findFile();
