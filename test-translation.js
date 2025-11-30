const axios = require('axios');

async function testTranslation() {
    try {
        console.log('🚀 Testing Translation Endpoint...\n');

        // 1. Get Projects
        console.log('📂 Fetching projects...');
        const projectsResponse = await axios.get('http://localhost:8080/api/projects');
        const projects = projectsResponse.data;

        console.log(`Found ${projects.length} projects.`);

        const project = projects.find(p => p.name === 'Prueba Archivo Real') || projects[0];

        if (!project) {
            console.error('❌ No projects found.');
            return;
        }

        console.log(`🎯 Using project: ${project.name} (${project.id})`);

        // 2. Get Files
        const projectResponse = await axios.get(`http://localhost:8080/api/projects/${project.id}`);
        const files = projectResponse.data.files;

        console.log(`📄 Found ${files.length} files.`);

        // 3. Find the specific user file
        const dwgFile = files.find(f => f.name.startsWith('SCFA')) || files.find(f => f.name.endsWith('.dwg'));

        if (!dwgFile) {
            console.error('❌ No DWG file found in project.');
            return;
        }

        console.log(`🎯 Target File: ${dwgFile.name} (ID: ${dwgFile.id})`);
        console.log(`📊 Current Status: ${dwgFile.status}`);
        console.log(`🔗 APS URN: ${dwgFile.apsUrn || 'None'}`);

        // 4. Trigger Translation
        console.log('\n🔄 Triggering translation...');

        try {
            const response = await axios.post(`http://localhost:8080/api/translation/${dwgFile.id}/translate`);
            console.log('✅ Response:', response.data);
        } catch (error) {
            console.error('\n❌ Translation Failed!');
            console.error('Status:', error.response?.status);
            console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        }

    } catch (error) {
        console.error('❌ Script Error:', error.message);
    }
}

testTranslation();
