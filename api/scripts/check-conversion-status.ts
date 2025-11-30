
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import { modelDerivativeService } from '../src/services/aps/model-derivative.service';

const prisma = new PrismaClient();

async function checkConversionStatus() {
    try {
        // Get the most recent conversion
        const conversion = await prisma.conversion.findFirst({
            orderBy: { createdAt: 'desc' },
            include: { file: true }
        });

        if (!conversion) {
            console.log('No conversions found');
            return;
        }

        console.log('Latest Conversion:');
        console.log(`- ID: ${conversion.id}`);
        console.log(`- File: ${conversion.file.name}`);
        console.log(`- Format: ${conversion.targetFormat}`);
        console.log(`- Status: ${conversion.status}`);
        console.log(`- Created: ${conversion.createdAt}`);
        await prisma.$disconnect();
    } catch (error) {
        console.error('Error checking conversion status:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

checkConversionStatus();
