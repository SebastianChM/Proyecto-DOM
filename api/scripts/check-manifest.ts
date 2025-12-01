
import * as dotenv from 'dotenv';
import * as path from 'path';
// Load env vars immediately
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { modelDerivativeService } from '../src/services/aps/model-derivative.service';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const RAW_URN = 'urn:adsk.objects:os.object:dom-bim-platform-us-test-001/1764554140148-mock-result.ifc';
const URN = Buffer.from(RAW_URN).toString('base64').replace(/=/g, '');

async function checkManifest() {
    try {
        // const file = await prisma.file.findUnique({ where: { id: FILE_ID } });
        // if (!file || !file.apsUrn) {
        //     console.log('File not found or URN is missing');
        //     return;
        // }
        console.log(`Checking manifest for URN: ${URN}`);
        try {
            const manifest = await modelDerivativeService.getManifest(URN);
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
