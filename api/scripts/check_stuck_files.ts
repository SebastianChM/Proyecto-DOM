
import { PrismaClient } from '@prisma/client';
import { modelDerivativeService } from '../src/services/aps/model-derivative.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function checkStuckFiles() {
    console.log('🔍 Checking for stuck files...');
    
    try {
        const files = await prisma.file.findMany({
            // where: { status: 'TRANSLATING' }
            orderBy: { updatedAt: 'desc' },
            take: 10
        });

        if (files.length === 0) {
            console.log('✅ No files found in DB.');
            return;
        }

        console.log(`⚠️ Found ${files.length} recent files:`);

        for (const file of files) {
            console.log(`\n📄 File: ${file.name} (ID: ${file.id})`);
            console.log(`   Project ID: ${file.projectId}`);
            console.log(`   Status: ${file.status}`);
            console.log(`   URN: ${file.apsUrn}`);
            console.log(`   Updated At: ${file.updatedAt}`);

            if (file.status !== 'READY' && file.status !== 'FAILED' && file.apsUrn && !file.apsUrn.startsWith('local-')) {
                try {
                    console.log('   🔄 Fetching manifest from APS...');
                    const manifest = await modelDerivativeService.getManifest(file.apsUrn);
                    console.log(`   APS Status: ${manifest.status}`);
                    console.log(`   Progress: ${manifest.progress}`);
                    
                    if (manifest.status === 'success') {
                        console.log('   ✅ APS says success! Updating DB...');
                        await prisma.file.update({
                            where: { id: file.id },
                            data: { status: 'READY' }
                        });
                        console.log('   ✅ DB Updated to READY');
                    } else if (manifest.status === 'failed') {
                        console.log('   ❌ APS says failed! Updating DB...');
                        await prisma.file.update({
                            where: { id: file.id },
                            data: { status: 'FAILED' }
                        });
                        console.log('   ❌ DB Updated to FAILED');
                    }
                } catch (error: any) {
                    console.error('   ❌ Error checking manifest:', error.response?.data || error.message);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkStuckFiles();
