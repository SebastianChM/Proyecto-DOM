const axios = require('axios');

async function checkBOM() {
    try {
        const fileId = '4dda8a83-35f9-4740-85c1-36ae12331b68';
        console.log(`Fetching BOM for file: ${fileId}`);
        const response = await axios.get(`http://localhost:8080/api/files/${fileId}/bom`);
        console.log('BOM Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error fetching BOM:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

checkBOM();
