
import * as dotenv from 'dotenv';
import * as path from 'path';
// Load env vars immediately
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import axios from 'axios';

const API_URL = 'http://localhost:8080';
const FILE_ID = '32af8a12-1211-4e59-afc9-40b872f4dd26'; // New PC2 file

async function testConversionFallback() {
    console.log(`🧪 Testing Conversion Fallback for file ${FILE_ID}...`);

    try {
        console.log(`1. Sending conversion request...`);
        const response = await axios.post(`${API_URL}/api/conversion/${FILE_ID}`, { format: 'pdf' });

        console.log('✅ Request Successful!');
        console.log('Response Data:', JSON.stringify(response.data, null, 2));

        if (response.data.message && response.data.message.includes('Model Derivative')) {
            console.log('✅ SUCCESS: Fallback to Model Derivative triggered!');
        } else if (response.data.message && response.data.message.includes('Design Automation')) {
            console.log('❓ Unexpected: Design Automation started? (Maybe it worked?)');
        }

    } catch (error: any) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testConversionFallback();
