const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFilesAndTestTranslation() {
    console.log('--- Checking UPLOADED files ---');
    
    // 1. Find files in UPLOADED state
    const files = await prisma.file.findMany({
        where: { status: 'UPLOADED' }
    });

    if (files.length === 0) {
        console.log('No files found in UPLOADED state.');
        return;
    }

    for (const file of files) {
        console.log(`\nChecking File: ${file.name} (ID: ${file.id})`);
        console.log(`APS URN: ${file.apsUrn}`);

        if (!file.apsUrn) {
            console.log('⚠️  WARNING: This file has NO APS URN. It will cause a 400 error.');
        }

        // 2. Try to trigger translation via API to reproduce error
        try {
            console.log(`Attempting to start translation for ${file.name}...`);
            await axios.post(`http://localhost:8080/api/translation/${file.id}/translate`);
            console.log('✅ Success (Unexpected for files without URN)');
        } catch (error) {
            console.log(`❌ Request Failed: ${error.message}`);
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Error Data:`, error.response.data);
            }
        }
    }
}

checkFilesAndTestTranslation()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
