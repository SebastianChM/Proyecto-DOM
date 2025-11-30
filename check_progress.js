const axios = require('axios');

const projectId = 'da39c775-7172-4a8d-8fe2-433261ba3782'; // Demo Project - Full Features
const url = `http://localhost:8080/api/files/project/${projectId}`;

async function checkProgress() {
    try {
        console.log(`Checking progress for project ${projectId}...`);
        const response = await axios.get(url);
        const files = response.data;
        
        files.forEach(f => {
            if (f.status === 'TRANSLATING') {
                console.log(`File: ${f.name}`);
                console.log(`Status: ${f.status}`);
                console.log(`Progress: ${f.progress}%`);
                console.log(`UpdatedAt: ${f.updatedAt}`);
                console.log(`Now: ${new Date().toISOString()}`);
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkProgress();
