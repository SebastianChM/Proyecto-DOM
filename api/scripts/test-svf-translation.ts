
import * as dotenv from 'dotenv';
import * as path from 'path';
// Load env vars immediately
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { modelDerivativeService } from '../src/services/aps/model-derivative.service';

const URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NDQ3MTcxMjg0OS1TQ0ZBLVBCLVBDMi1BUlEtR0VOLVBMRy0wMDAxLmR3Zw';

async function testSvf() {
    console.log('🧪 Testing SVF Translation...');

    try {
        // We don't have a direct method for SVF in the service that returns the job result easily without just calling translate
        // But let's use the internal API call logic to be sure.

        const token = await import('../src/services/aps/auth.service').then(m => m.apsAuthService.getInternalToken());
        const axios = require('axios');

        const job = {
            input: { urn: URN },
            output: {
                formats: [{ type: 'svf', views: ['2d', '3d'] }]
            }
        };

        console.log('Sending SVF job...');
        const response = await axios.post(
            'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
            job,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'x-ads-force': 'true'
                }
            }
        );

        console.log('✅ SVF Job Started:', response.data);

    } catch (error: any) {
        console.error('❌ SVF Failed:', error.response?.data || error.message);
    }
}

testSvf();
