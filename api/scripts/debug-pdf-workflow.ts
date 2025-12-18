
import * as dotenv from 'dotenv';
dotenv.config();

import { modelDerivativeService } from '../src/services/aps/model-derivative.service';

const TARGET_URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTMyNTQ1OTkxNy1DTUEtSURPLUlELUVMWC1YLVgtMTktMDAwMC0wMC5ydnQ';

async function main() {
    console.log('🐞 Starting Deep Debug of PDF Workflow...');
    console.log(`📂 Target URN: ${TARGET_URN}`);

    try {
        console.log('\n--- Calling translateToPDF ---');
        const result = await modelDerivativeService.translateToPDF(TARGET_URN);
        console.log('\n✅ SUCCESS: Workflow completed successfully.');
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error: any) {
        console.error('\n❌ CRITICAL FAILURE: Workflow failed after all attempts.');
        console.error('Error Message:', error.message);
        if (error.response?.data) {
            console.error('APS Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

main();
