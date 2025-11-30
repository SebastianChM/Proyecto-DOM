const axios = require('axios');

const projectId = '3a2caeed-9e43-4ddb-b875-d58b139bed1b'; // Mock Project (from cache folder structure or inferred)
// Wait, I need the ID for "Mock Project" or "Demo Project - Full Features"
// From check_files.js output:
// Mock Project ID is not explicitly listed with ID, but file 4dda8a83... is in Mock Project.
// Let's use the project ID for file 2546b9a6... which is in "Demo Project - Full Features"
// I need to find the project ID for that file.

// Let's query the file directly to get its project ID
const fileId = '2546b9a6-764c-4810-a2ce-aa62da61c0a9';
const url = `http://localhost:8080/api/files/${fileId}`;

async function checkApiFields() {
    try {
        console.log(`Fetching file from ${url}...`);
        const response = await axios.get(url);
        const file = response.data;
        
        console.log('File:', file.name);
        console.log('Status:', file.status);
        console.log('Progress Field:', file.progress); 
        
        if (file.progress === undefined) {
            console.log('❌ "progress" field is MISSING. The backend code changes are NOT active.');
        } else {
            console.log(`✅ "progress" field is present: ${file.progress}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkApiFields();
