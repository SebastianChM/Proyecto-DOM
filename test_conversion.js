const axios = require('axios');

const fileId = '76826b8c-c498-4bd7-a965-ed85137cc02f';
const url = `http://localhost:8080/api/conversion/${fileId}`;

async function testConversion() {
    try {
        console.log(`1. Triggering conversion to PDF for file ${fileId}...`);
        const response = await axios.post(url, { format: 'pdf' });
        console.log('Conversion Response:', response.data);
        
        const conversionId = response.data.conversion.id;
        console.log(`Conversion ID: ${conversionId}`);

        console.log('2. Polling for status...');
        const pollInterval = setInterval(async () => {
            try {
                const statusResponse = await axios.get(`http://localhost:8080/api/conversion/${conversionId}`);
                const status = statusResponse.data.status;
                console.log(`Current Status: ${status}`);

                if (status === 'COMPLETED') {
                    console.log('✅ Conversion COMPLETED!');
                    console.log('Result URL:', statusResponse.data.resultUrl);
                    clearInterval(pollInterval);
                } else if (status === 'FAILED') {
                    console.log('❌ Conversion FAILED.');
                    clearInterval(pollInterval);
                }
            } catch (e) {
                console.error('Polling error:', e.message);
            }
        }, 2000);

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testConversion();
