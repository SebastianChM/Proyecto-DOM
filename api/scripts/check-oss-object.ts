
import * as dotenv from 'dotenv';
import * as path from 'path';
// Load env vars immediately
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ObjectsApi } from 'forge-apis';
import { apsAuthService } from '../src/services/aps/auth.service';

const BUCKET_KEY = process.env.APS_BUCKET || 'dom-bim-platform-us-test-001';
const OBJECT_KEY = '1764471712849-SCFA-PB-PC2-ARQ-GEN-PLG-0001.dwg';

async function checkObject() {
    console.log(`Checking object ${OBJECT_KEY} in bucket ${BUCKET_KEY}...`);

    try {
        const token = await apsAuthService.getInternalToken();
        const objectsApi = new ObjectsApi();

        const details = await objectsApi.getObjectDetails(BUCKET_KEY, OBJECT_KEY, {
            'Authorization': `Bearer ${token}`
        }, {
            autoRefresh: false
        }); // The type definition might be slightly different, let's try basic call

        // If the SDK call is complex, let's use axios for simplicity and certainty
        // But let's try to just print what we get if it works.
        // Actually, let's use Axios to be 100% sure of what we are doing.
    } catch (e) {
        // SDK might throw
    }

    // AXIOS Fallback
    const axios = require('axios');
    try {
        const token = await apsAuthService.getInternalToken();
        const url = `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${OBJECT_KEY}/details`;

        console.log('Calling OSS API via Axios:', url);
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('✅ Object Details:');
        console.log(`- Size: ${response.data.size} bytes`);
        console.log(`- Content-Type: ${response.data.contentType}`);
        console.log(`- Location: ${response.data.location}`);

        if (response.data.size === 0) {
            console.error('❌ CRITICAL: File size is 0 bytes! Upload failed.');
        }

    } catch (error: any) {
        console.error('❌ Failed to get object details:', error.response?.status, error.response?.data || error.message);
    }
}

checkObject();
