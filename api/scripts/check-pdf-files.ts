import prisma from '../src/lib/prisma';

async function main() {
    const files = await prisma.file.findMany({
        where: { type: 'PDF' },
        take: 5,
        select: {
            id: true,
            name: true,
            type: true,
            s3Key: true,
            apsUrn: true,
            apsProjectId: true,
            apsItemId: true,
            apsStorageId: true,
            origin: true
        }
    });

    console.log('PDF Files in database:');
    files.forEach((file, i) => {
        console.log(`\n--- File ${i + 1} ---`);
        console.log(`ID: ${file.id}`);
        console.log(`Name: ${file.name}`);
        console.log(`s3Key: ${file.s3Key}`);
        console.log(`apsUrn: ${file.apsUrn?.substring(0, 50)}...`);
        console.log(`apsProjectId: ${file.apsProjectId || 'NULL'}`);
        console.log(`apsItemId: ${file.apsItemId || 'NULL'}`);
        console.log(`apsStorageId: ${file.apsStorageId || 'NULL'}`);
        console.log(`origin: ${file.origin}`);
    });

    await prisma.$disconnect();
}

main().catch(console.error);
