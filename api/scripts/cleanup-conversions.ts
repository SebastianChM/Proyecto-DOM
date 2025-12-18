import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning up stuck conversions...\n');

    // Mark old PROCESSING conversions as FAILED
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const updated = await prisma.conversion.updateMany({
        where: {
            status: 'PROCESSING',
            createdAt: { lt: thirtyMinutesAgo }
        },
        data: {
            status: 'FAILED',
            error: 'Conversion timed out (cleaned up by maintenance script)'
        }
    });

    console.log(`✅ Marked ${updated.count} stuck conversions as FAILED`);

    // Also mark very old PENDING conversions as FAILED
    const updatedPending = await prisma.conversion.updateMany({
        where: {
            status: 'PENDING',
            createdAt: { lt: thirtyMinutesAgo }
        },
        data: {
            status: 'FAILED',
            error: 'Conversion never started (cleaned up by maintenance script)'
        }
    });

    console.log(`✅ Marked ${updatedPending.count} stuck pending conversions as FAILED`);

    await prisma.$disconnect();
    console.log('\nDone!');
}

main().catch(console.error);
