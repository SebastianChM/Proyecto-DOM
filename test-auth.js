const axios = require('axios');
const qs = require('querystring');

const clientId = 'RIi0BvKIEfSsBad3EoRdBkTAruI7i8kUjG0l0S54Wfv3GMUi';
const clientSecret = 'TFvrMRi77n5Eptxoko9RAKYL3WEcVXRQ1nAEGddiqG0Q10BvX7iugequcahgv6sg';
const scopes = 'data:read data:write data:create bucket:read bucket:create bucket:delete';

async function testAuth() {
    try {
        console.log('Testing APS Authentication...');

        const data = qs.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: scopes
        });

        const response = await axios.post('https://developer.api.autodesk.com/authentication/v2/token', data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log('✅ Auth Successful!');
        const token = response.data.access_token;

        // Try to Create Bucket in EMEA
        const bucketKey = `dom-test-emea-${Date.now()}`;
        console.log(`\nTrying to create bucket in EMEA: ${bucketKey}...`);

        try {
            await axios.post('https://developer.api.autodesk.com/oss/v2/buckets', {
                bucketKey: bucketKey,
                policyKey: 'transient'
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'x-ads-region': 'EMEA'
                }
            });
            console.log('✅ EMEA Bucket Created!');

            // Try Resumable upload to EMEA bucket
            console.log('Trying Resumable upload to EMEA bucket...');
            const objectName = 'test-resumable.txt';
            const content = 'Hello EMEA Resumable';
            const range = `bytes 0-${content.length - 1}/${content.length}`;

            const upload = await axios.put(
                `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectName}/resumable`,
                content,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/octet-stream',
                        'Content-Range': range,
                        'Session-Id': `session-${Date.now()}`,
                        'x-ads-region': 'EMEA'
                    }
                }
            );
            console.log('✅ Resumable Upload to EMEA Successful!', upload.data);

        } catch (e) {
            console.error('❌ EMEA Resumable Failed:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('❌ Fatal Error:', error.message);
    }
}

testAuth();
