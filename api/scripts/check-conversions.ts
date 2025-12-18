import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking recent conversions...');

    const conversions = await prisma.conversion.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { file: { select: { name: true, type: true } } }
    });

    console.log('\n=== ÚLTIMAS 5 CONVERSIONES ===\n');

    for (const c of conversions) {
        console.log(`ID: ${c.id}`);
        console.log(`  Archivo: ${c.file.name} (${c.file.type})`);
        console.log(`  Formato destino: ${c.targetFormat}`);
        console.log(`  Estado: ${c.status}`);
        console.log(`  Error: ${c.error || 'ninguno'}`);
        console.log(`  Creado: ${c.createdAt}`);
        console.log(`  ResultUrn: ${c.resultUrn || 'N/A'}`);
        console.log('');
    }

    await prisma.$disconnect();
}

main().catch(console.error);
