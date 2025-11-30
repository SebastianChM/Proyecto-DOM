
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDwgFile() {
    try {
        const file = await prisma.file.findFirst({
            where: {
                name: {
                    endsWith: '.dwg'
                }
            }
        });

        if (file) {
            console.log(`✅ Found DWG file: ${file.name} (ID: ${file.id})`);
        } else {
            console.log('❌ No DWG file found in database.');
            // List any file just in case
            const anyFile = await prisma.file.findFirst();
            if (anyFile) {
                console.log(`ℹ️ Found other file: ${anyFile.name} (ID: ${anyFile.id})`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findDwgFile();
