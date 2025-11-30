const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function uploadRealFile() {
    try {
        console.log('🚀 Starting real file upload to APS...\n');

        // You need to provide a real RVT or DWG file
        // Replace this path with an actual file on your system
        const filePath = 'C:\\Users\\Sebastian\\Desktop\\sample.rvt'; // CHANGE THIS PATH

        if (!fs.existsSync(filePath)) {
            console.error('❌ File not found:', filePath);
            console.log('\n📝 Instructions:');
            console.log('1. Find a small RVT or DWG file on your computer');
            console.log('2. Update the filePath variable in this script');
            console.log('3. Run this script again');
            return;
        }

        const fileName = path.basename(filePath);
        const fileSize = fs.statSync(filePath).size;

        console.log('📁 File:', fileName);
        console.log('📊 Size:', (fileSize / 1024 / 1024).toFixed(2), 'MB\n');

        // Get project ID (using the demo project we created)
        const projectId = 'd2a26f2d-24fa-4469-831d-b7a4c617af20'; // Demo Project ID

        // Create form data
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('projectId', projectId);

        console.log('⬆️  Uploading to backend...');

        const response = await axios.post('http://localhost:8080/api/files/upload', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        console.log('\n✅ Upload successful!');
        console.log('📋 File ID:', response.data.id);
        console.log('📊 Status:', response.data.status);
        console.log('🔗 APS URN:', response.data.apsUrn || 'Pending translation...');

        console.log('\n⏳ Waiting for translation...');
        console.log('This may take 1-5 minutes depending on file size.\n');

        // Poll for translation status
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (5 seconds * 60)

        const pollInterval = setInterval(async () => {
            attempts++;

            try {
                const fileResponse = await axios.get(`http://localhost:8080/api/files/${response.data.id}`);
                const status = fileResponse.data.status;

                process.stdout.write(`\r🔄 Status: ${status} (${attempts}/${maxAttempts})    `);

                if (status === 'READY') {
                    clearInterval(pollInterval);
                    console.log('\n\n🎉 Translation complete!');
                    console.log('✅ File is ready for:');
                    console.log('   - 3D Viewing');
                    console.log('   - BOM Extraction');
                    console.log('   - PDF Conversion');
                    console.log('   - IFC Conversion');
                    console.log('\n🔗 View in browser:');
                    console.log(`   http://localhost:3000/dashboard/projects/${projectId}`);
                } else if (status === 'FAILED') {
                    clearInterval(pollInterval);
                    console.log('\n\n❌ Translation failed!');
                    console.log('Check the backend logs for details.');
                } else if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    console.log('\n\n⏱️  Timeout reached.');
                    console.log('Translation is still in progress. Check the dashboard.');
                }
            } catch (pollError) {
                console.error('\n❌ Error checking status:', pollError.message);
            }
        }, 5000);

    } catch (error) {
        console.error('\n❌ Upload failed:', error.response?.data || error.message);

        if (error.code === 'ENOENT') {
            console.log('\n📝 File not found. Please check the file path.');
        }
    }
}

uploadRealFile();
