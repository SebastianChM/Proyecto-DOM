
import fs from 'fs';
import path from 'path';

async function testComplianceApi() {
    const filePath = path.join(__dirname, '../mock-data/ChileSpec.txt');
    const url = 'http://localhost:8080/api/compliance/analyze/spec';

    console.log(`🚀 Testing API Upload: ${url}`);

    // Create Form Data manually (since we don't have 'form-data' package types easily available in this script scope)
    // Actually, Node 18+ fetch supports FormData natively.
    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(filePath)], { type: 'text/plain' });
    formData.append('file', blob, 'ChileSpec.txt');

    try {
        const startTime = Date.now();
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        const duration = Date.now() - startTime;
        console.log(`⏱️ Request took ${duration}ms`);
        console.log(`📡 Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errText = await response.text();
            console.error('❌ Error Response:', errText);
            process.exit(1);
        }

        const data = await response.json() as any;
        console.log('✅ Response JSON:', JSON.stringify(data, null, 2));

        // Assertions
        if (data.success !== true) throw new Error('Success flag missing');
        if (!data.data || data.data.length === 0) throw new Error('No requirements returned');

        console.log('🎉 INTEGRATION TEST PASSED: Backend is recognizing the Spec!');

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

testComplianceApi();
