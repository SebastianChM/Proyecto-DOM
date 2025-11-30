const axios = require('axios');

const fileId = '500fb41b-f4c9-47cc-9df3-a4bb18f3b0f2';
const url = `http://localhost:8080/api/files/${fileId}`;

async function checkStatus() {
    try {
        console.log(`Checking status for file ${fileId}...`);
        const response = await axios.get(url);
        const file = response.data;
        console.log(`Status: ${file.status}`);
        console.log(`APS URN: ${file.apsUrn}`);
        
        if (file.status === 'READY') {
            console.log('✅ File is READY!');
        } else if (file.status === 'FAILED') {
            console.log('❌ File translation FAILED.');
        } else {
            console.log('⏳ File is still TRANSLATING...');
        }
    } catch (error) {
        console.error('Error checking status:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

checkStatus();
