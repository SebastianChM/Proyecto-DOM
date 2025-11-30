const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function uploadFile() {
    try {
        const form = new FormData();
        const filePath = path.join(__dirname, 'test-mock.rvt');

        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return;
        }

        form.append('file', fs.createReadStream(filePath));
        form.append('projectId', '7a997146-c612-41d5-b700-136b3cdd4f7a');

        console.log('Uploading file...');
        const response = await axios.post('http://localhost:8080/api/files/upload', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('Upload successful!');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        if (response.data.file.status === 'LOCAL_ONLY') {
            console.log('\nWaiting 6 seconds for mock translation...');
            await new Promise(resolve => setTimeout(resolve, 6000));

            console.log('Checking file status...');
            const fileResponse = await axios.get(`http://localhost:8080/api/files/${response.data.file.id}`);
            console.log('Updated File Status:', fileResponse.data.status);
        }

    } catch (error) {
        console.error('Upload failed:', error);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received');
        } else {
            console.error('Error setting up request:', error.message);
        }
    }
}

uploadFile();
