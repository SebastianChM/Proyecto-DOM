import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { apsAuthService } from '../src/services/aps/auth.service';
import { apsOssService } from '../src/services/aps/oss.service';
import axios from 'axios';

async function runBenchmark() {
    console.log('🚀 Starting Benchmark: Old Way vs. New Way (Server-side Copy)');
    
    try {
        // Ensure we have a token
        await apsAuthService.getInternalToken();
        const bucketKey = process.env.APS_BUCKET || 'dom-bim-platform-us-test-001';

        // 1. Setup: Create a dummy file in OSS to act as our "Source"
        console.log('\n📦 Setting up test file...');
        const testContent = Buffer.alloc(5 * 1024 * 1024, 'x'); // 5MB dummy file
        const sourceFilename = `benchmark-source-${Date.now()}.bin`;
        const sourceObj = await apsOssService.uploadBuffer(testContent, sourceFilename);
        console.log(`   Source file created: ${sourceObj.objectKey} (5MB)`);

        // ==========================================
        // BENCHMARK 1: The Old Way (Download + Upload)
        // ==========================================
        console.log('\n🐢 Running Benchmark 1: The Old Way (Download -> Memory -> Upload)');
        const startOld = performance.now();

        // Step A: Download
        console.log('   [Old Way] Downloading...');
        // Use signed URL for download as direct GET might be deprecated
        const signedDownloadUrl = await apsOssService.getSignedUrl(sourceObj.objectKey);
        if (!signedDownloadUrl) throw new Error('Failed to get signed URL');

        const dlResponse = await axios.get(signedDownloadUrl, {
            responseType: 'arraybuffer'
        });
        const buffer = Buffer.from(dlResponse.data);
        console.log(`   [Old Way] Downloaded ${buffer.length} bytes`);

        // Step B: Upload
        console.log('   [Old Way] Uploading...');
        const oldWayFilename = `benchmark-old-${Date.now()}.bin`;
        await apsOssService.uploadBuffer(buffer, oldWayFilename);
        console.log('   [Old Way] Upload complete');

        const endOld = performance.now();
        const timeOld = (endOld - startOld) / 1000;
        console.log(`   ⏱️  Time taken: ${timeOld.toFixed(2)} seconds`);


        // ==========================================
        // BENCHMARK 2: The New Way (Server-side Copy)
        // ==========================================
        console.log('\n⚡ Running Benchmark 2: The New Way (Server-side Copy)');
        const startNew = performance.now();

        const newWayFilename = `benchmark-new-${Date.now()}.bin`;
        await apsOssService.copyObject(sourceObj.objectKey, newWayFilename);

        const endNew = performance.now();
        const timeNew = (endNew - startNew) / 1000;
        console.log(`   ⏱️  Time taken: ${timeNew.toFixed(2)} seconds`);

        // ==========================================
        // RESULTS
        // ==========================================
        console.log('\n📊 Final Results:');
        console.log(`   🐢 Old Way: ${timeOld.toFixed(2)}s`);
        console.log(`   ⚡ New Way: ${timeNew.toFixed(2)}s`);
        
        const improvement = timeOld / timeNew;
        console.log(`   🚀 Improvement: ${improvement.toFixed(1)}x faster!`);

    } catch (error: any) {
        console.error('❌ Benchmark failed:', error.message);
        if (error.response) {
            console.error('   Details:', error.response.data);
        }
    }
}

runBenchmark();
