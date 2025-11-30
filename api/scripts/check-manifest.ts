
import * as dotenv from 'dotenv';
import * as path from 'path';
// Load env vars immediately
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { modelDerivativeService } from '../src/services/aps/model-derivative.service';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const FILE_ID = '32af8a12-1211-4e59-afc9-40b872f4dd26'; // New PC2 file

async function checkManifest() {
    try {
        const file = await prisma.file.findUnique({ where: { id: FILE_ID } });
        if (!file || !file.apsUrn) {
            console.log('File not found or URN is missing');
            return;
        }
        console.log(`Checking manifest for URN: ${file.apsUrn}`);
        try {
            const manifest = await modelDerivativeService.getManifest(file.apsUrn);
            console.log('Manifest Status:', manifest.status);
            console.log('\nFull Manifest:');
            console.log(JSON.stringify(manifest, null, 2));
        } catch (e: any) {
            console.error('Error getting manifest:', e.response?.data || e.message);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkManifest();
