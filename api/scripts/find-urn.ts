
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const urn = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6bXlidWNrZXQvbXlmaWxlLnJ2dA==';
    console.log(`Searching for file with URN: ${urn}`);

    const file = await prisma.file.findFirst({
        where: {
            apsUrn: urn
        }
    });

    if (file) {
        console.log('Found file:', file);
    } else {
        console.log('No file found with that URN.');

        // List all files to be sure
        const allFiles = await prisma.file.findMany({
            select: { id: true, name: true, apsUrn: true }
        });
        console.log('All files:', allFiles);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
