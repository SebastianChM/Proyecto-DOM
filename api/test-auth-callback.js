const axios = require('axios');

async function testCallback() {
    try {
        console.log('Hitting callback endpoint...');
        // We expect this to fail because 'fake-code' is invalid, 
        // but it should trigger the first few lines of the route handler where logging happens.
        await axios.get('http://localhost:8080/api/auth/callback?code=fake-code');
    } catch (error) {
        console.log('Request finished (expected failure):', error.response ? error.response.status : error.message);
    }
}

testCallback();
