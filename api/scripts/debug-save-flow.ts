
import { PrismaClient } from '@prisma/client';
import { modelDerivativeService } from '../src/services/aps/model-derivative.service';
import { apsDataService } from '../src/services/aps/data-management.service';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function debugSaveFlow() {
    console.log('🔍 Finding recent completed conversion...');
    
    const conversion = await prisma.conversion.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: { file: true }
    });

    if (!conversion) {
        console.error('❌ No completed conversion found to test with.');
        return;
    }

    console.log(`✅ Found conversion: ${conversion.id}`);
    console.log(`   File: ${conversion.file.name} (${conversion.file.apsUrn})`);
    console.log(`   Result URN: ${conversion.resultUrn}`);
    console.log(`   Format: ${conversion.targetFormat}`);

    if (!conversion.file.apsUrn || !conversion.resultUrn) {
        console.error('❌ Missing URNs');
        return;
    }

    try {
        // Step 1: Get Download URL
        console.log('\n1️⃣ Testing Signed Cookie Download URL...');
        const { url: downloadUrl, headers: downloadHeaders } = await modelDerivativeService.getDerivativeDownloadInfo(
            conversion.file.apsUrn, 
            conversion.resultUrn
        );
        console.log('✅ Got URL:', downloadUrl.substring(0, 50) + '...');
        console.log('✅ Got Headers:', JSON.stringify(downloadHeaders));

        // Step 2: Download File
        console.log('\n2️⃣ Testing File Download...');
        const response = await axios.get(downloadUrl, {
            headers: downloadHeaders,
            responseType: 'arraybuffer',
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const buffer = Buffer.from(response.data);
        console.log(`✅ Downloaded ${buffer.length} bytes`);

        // Step 3: Upload to OSS
        console.log('\n3️⃣ Testing OSS Upload (Direct S3)...');
        const newFilename = `debug-save-${Date.now()}.${conversion.targetFormat}`;
        const uploadedObject = await apsDataService.uploadBuffer(buffer, newFilename);
        console.log(`✅ Uploaded to OSS: ${uploadedObject.objectId}`);

        // Step 4: DB Creation (Dry Run)
        console.log('\n4️⃣ Testing DB Record Creation (Dry Run)...');
        const urn = apsDataService.getDerivativeUrn(uploadedObject.objectId);
        console.log(`   Generated URN: ${urn}`);
        
        console.log('✅ All steps passed successfully!');

    } catch (error: any) {
        console.error('\n❌ TEST FAILED');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Stack:', error.stack);
        }
    } finally {
        await prisma.$disconnect();
    }
}

debugSaveFlow();
