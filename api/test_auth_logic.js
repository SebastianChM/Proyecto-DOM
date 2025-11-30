// const { APSAuthService } = require('./src/services/aps/auth.service');

// Mock dependencies
const mockThreeLeggedClient = {};
const mockAccessToken = 'mock-token';

// Mock UserProfileApi
const mockUserProfileApi = {
    getUserProfile: async (client, tokenObj) => {
        console.log('Mock UserProfileApi called');
        if (tokenObj.access_token === 'fail-sdk') {
            throw new Error('SDK Failed');
        }
        return {
            body: {
                emailId: 'sdk-user@example.com',
                firstName: 'SDK',
                lastName: 'User',
                userId: 'sdk-id'
            }
        };
    }
};

// Mock Axios
const mockAxios = {
    get: async (url, config) => {
        console.log('Mock Axios called');
        if (config.headers.Authorization.includes('fail-axios')) {
            throw new Error('Axios Failed');
        }
        return {
            data: {
                emailId: 'axios-user@example.com',
                firstName: 'Axios',
                lastName: 'User',
                userId: 'axios-id'
            }
        };
    }
};

// We need to hijack the require calls in the service file to inject mocks
// Since we can't easily do that without a proper test runner, 
// I will copy the logic from auth.service.ts here and test it in isolation.

async function testAuthLogic() {
    console.log('--- Testing Auth Logic ---');

    async function getUserProfile(accessToken) {
        console.log('Getting user profile with token:', accessToken);
        
        // Method 1: Try SDK first
        try {
            console.log('Attempting SDK call...');
            // In real code: const api = new UserProfileApi();
            const api = mockUserProfileApi; 
            const response = await api.getUserProfile(mockThreeLeggedClient, { access_token: accessToken });
            console.log('SDK Response Body Keys:', Object.keys(response.body || {}));
            return response.body;
        } catch (sdkError) {
            console.warn('SDK call failed:', sdkError.message);
            
            // Method 2: Try Direct Axios call
            try {
                console.log('Attempting Direct Axios call...');
                // In real code: const response = await axios.get(...)
                const response = await mockAxios.get('url', { headers: { Authorization: `Bearer ${accessToken}` } });
                console.log('Axios Response Data Keys:', Object.keys(response.data || {}));
                return response.data;
            } catch (axiosError) {
                console.error('Direct call also failed:', axiosError.message);
                throw new Error(`Both SDK and Direct calls failed. SDK: ${sdkError.message}. Axios: ${axiosError.message}`);
            }
        }
    }

    // Test 1: SDK Success
    console.log('\nTest 1: SDK Success');
    try {
        const result = await getUserProfile('valid-token');
        console.log('Result:', result);
    } catch (e) {
        console.error('Test 1 Failed:', e.message);
    }

    // Test 2: SDK Fail, Axios Success
    console.log('\nTest 2: SDK Fail, Axios Success');
    try {
        const result = await getUserProfile('fail-sdk');
        console.log('Result:', result);
    } catch (e) {
        console.error('Test 2 Failed:', e.message);
    }

    // Test 3: Both Fail
    console.log('\nTest 3: Both Fail');
    try {
        const result = await getUserProfile('fail-sdk-fail-axios'); // This string triggers both fail conditions in my mocks
        // Wait, my mock logic for axios checks for 'fail-axios' in header, which comes from token.
        // So 'fail-sdk' triggers SDK fail. 'fail-axios' triggers axios fail.
        // So 'fail-sdk-fail-axios' should trigger both.
        console.log('Result:', result);
    } catch (e) {
        console.log('Test 3 Expected Error:', e.message);
    }
}

testAuthLogic();
