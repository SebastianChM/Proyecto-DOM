
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const urn = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6bXlidWNrZXQvbXlmaWxlLnJ2dA==';
    console.log(`Deleting file with URN: ${urn}`);

    const result = await prisma.file.deleteMany({
        where: {
            apsUrn: urn
        }
    });

    console.log(`Deleted ${result.count} file(s).`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
