const axios = require('axios');

const fileId = 'f1423971-9c8d-4e60-becc-a6b923f3291a';
const triggerUrl = `http://localhost:8080/api/translation/${fileId}/translate`;
const statusUrl = `http://localhost:8080/api/files/${fileId}`;

async function testSecondFile() {
    try {
        console.log(`1. Triggering translation for file ${fileId}...`);
        const triggerResponse = await axios.post(triggerUrl);
        console.log('Trigger Response:', triggerResponse.data);

        console.log('2. Checking status immediately...');
        const statusResponse = await axios.get(statusUrl);
        console.log(`Current Status: ${statusResponse.data.status}`);

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testSecondFile();
