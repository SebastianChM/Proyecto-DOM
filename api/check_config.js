const axios = require('axios');

async function checkConfig() {
    try {
        const response = await axios.get('http://localhost:8080/debug/aps-config');
        console.log('APS Config:', response.data);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkConfig();
