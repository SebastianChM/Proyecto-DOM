
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:8080/api';

async function main() {
    const args = process.argv.slice(2);
    const searchName = args[0] || 'CMA';

    console.log(`🔍 Searching for file with name containing: "${searchName}"...`);

    const file = await prisma.file.findFirst({
        where: {
            name: { contains: searchName }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (!file) {
        console.error('❌ File not found.');
        process.exit(1);
    }

    console.log(`📄 Found File: ${file.name} (ID: ${file.id})`);

    try {
        // 1. Trigger Conversion
        console.log(`🚀 Requesting PDF conversion...`);
        const triggerRes = await axios.post(`${API_URL}/conversion/${file.id}`, {
            format: 'pdf',
            sheets: [] // Standard request
        });

        console.log(`✅ Response Status: ${triggerRes.status} ${triggerRes.statusText}`);
        if (triggerRes.status === 202) {
            console.log(`✅ Job Queued: ${triggerRes.data.message}`);
        } else {
            console.log(`⚠️ Unexpected Status:`, triggerRes.data);
        }

        const conversionId = triggerRes.data.conversion.id;
        console.log(`🆔 Conversion ID: ${conversionId}`);

        // 2. Poll Status
        console.log(`⏳ Polling for result...`);

        const maxRetries = 30; // 60 seconds
        let attempts = 0;

        const poll = setInterval(async () => {
            attempts++;
            try {
                const statusRes = await axios.get(`${API_URL}/conversion/${conversionId}`);
                const data = statusRes.data;

                process.stdout.write(`\r   Attempt ${attempts}: ${data.status}       `);

                if (data.status === 'COMPLETED') {
                    clearInterval(poll);
                    console.log(`\n\n✅ SUCCESS!`);
                    console.log(`   Result URN: ${data.resultUrn}`);
                    console.log(`   Download URL: ${data.resultUrl}`);
                    process.exit(0);
                } else if (data.status === 'FAILED') {
                    clearInterval(poll);
                    console.log(`\n\n❌ FAILED!`);
                    console.log(`   Error Message: "${data.error}"`);
                    console.log(`   (This proves the fix if it matches the expected error)`);
                    process.exit(0);
                }

                if (attempts >= maxRetries) {
                    clearInterval(poll);
                    console.log(`\n\n⚠️ Timeout waiting for conversion.`);
                    process.exit(1);
                }

            } catch (err: any) {
                console.error(`\nPoll Error: ${err.message}`);
            }
        }, 2000);

    } catch (error: any) {
        console.error('\n❌ API Request Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

main();
