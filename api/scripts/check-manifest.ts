
import * as dotenv from 'dotenv';
dotenv.config();

import { modelDerivativeService } from '../src/services/aps/model-derivative.service';

const TARGET_URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTMyNTQ1OTkxNy1DTUEtSURPLUlELUVMWC1YLVgtMTktMDAwMC0wMC5ydnQ';

async function main() {
    console.log('📊 Checking Manifest for CMA File...');
    console.log(`📂 URN: ${TARGET_URN}`);

    try {
        console.log('\n--- Getting Manifest ---');
        const manifest = await modelDerivativeService.getManifest(TARGET_URN);
        console.log('✅ Manifest retrieved:');
        console.log(JSON.stringify(manifest, null, 2));

        console.log('\n--- Getting Metadata ---');
        const metadata = await modelDerivativeService.getMetadata(TARGET_URN);
        console.log('✅ Metadata retrieved:');
        console.log(JSON.stringify(metadata, null, 2));

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('APS Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

main();
