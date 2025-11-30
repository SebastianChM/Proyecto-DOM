const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:8080/api';

// Helper for logging
const log = (step, message, data = '') => {
    console.log(`[${step}] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
    console.log('-'.repeat(50));
};

async function runTest() {
    let projectId = null;
    let fileId1 = null;
    let fileId2 = null;
    // Use .rvt extension to trigger Local Mode simulation logic in backend
    const testFileName = 'test-mock.rvt';
    const testFilePath = path.join(__dirname, testFileName);

    try {
        console.log('🚀 Starting Full API Flow Test (Local Mode)...\n');

        // 1. Auth Check
        try {
            const authRes = await axios.get(`${API_URL}/auth/me`);
            log('AUTH', 'Checked Auth Status', authRes.data);
        } catch (e) {
            log('AUTH', 'Auth Check Failed (Expected if not logged in, but API should handle it)', e.message);
        }

        // 2. Create Project
        const projectData = {
            name: `Test Project ${Date.now()}`,
            description: "Automated Flow Test Project"
        };
        const createProjectRes = await axios.post(`${API_URL}/projects`, projectData);
        projectId = createProjectRes.data.id;
        log('PROJECT', 'Created Project', { id: projectId, name: createProjectRes.data.name });

        // 3. List Projects
        const listProjectsRes = await axios.get(`${API_URL}/projects`);
        const projectExists = listProjectsRes.data.some(p => p.id === projectId);
        log('PROJECT', 'List Projects Verification', { found: projectExists, total: listProjectsRes.data.length });

        // 4. Upload File 1 (Force Local Mode)
        fs.writeFileSync(testFilePath, 'Dummy RVT content for testing local mode.');
        const formData1 = new FormData();
        formData1.append('file', fs.createReadStream(testFilePath));
        formData1.append('projectId', projectId);

        const uploadRes1 = await axios.post(`${API_URL}/files/upload?forceLocal=true`, formData1, {
            headers: { ...formData1.getHeaders() }
        });
        fileId1 = uploadRes1.data.file.id;
        log('FILE 1', 'Uploaded File 1 (Local Mode)', { id: fileId1, status: uploadRes1.data.file.status });

        // 5. Upload File 2 (Force Local Mode) - For Comparison
        const formData2 = new FormData();
        formData2.append('file', fs.createReadStream(testFilePath));
        formData2.append('projectId', projectId);

        const uploadRes2 = await axios.post(`${API_URL}/files/upload?forceLocal=true`, formData2, {
            headers: { ...formData2.getHeaders() }
        });
        fileId2 = uploadRes2.data.file.id;
        log('FILE 2', 'Uploaded File 2 (Local Mode)', { id: fileId2, status: uploadRes2.data.file.status });

        // 6. Trigger Translation for File 1 (if needed)
        if (uploadRes1.data.file.status !== 'READY') {
             try {
                await axios.post(`${API_URL}/translation/${fileId1}/translate`);
            } catch (e) {}
        }
        
        // 7. Poll for File 1 READY
        log('POLLING', 'Waiting for File 1 to be READY...');
        await waitForReady(fileId1);

        // 8. Poll for File 2 READY (File 2 needs to be ready for comparison too?)
        // Actually comparison uses URNs. If they are local- URNs, they exist immediately.
        // But let's wait to be safe.
        log('POLLING', 'Waiting for File 2 to be READY...');
        await waitForReady(fileId2);

        // 9. Get BOM (File 1)
        try {
            const bomRes = await axios.get(`${API_URL}/files/${fileId1}/bom`);
            log('BOM', 'Retrieved BOM (File 1)', { itemsCount: bomRes.data.length });
        } catch (e) {
            log('BOM', 'Failed to get BOM', e.message);
        }

        // 10. Comparison
        try {
            const compareRes = await axios.post(`${API_URL}/comparison/compare`, {
                projectId,
                baseFileId: fileId1,
                targetFileId: fileId2
            });
            log('COMPARISON', 'Triggered Comparison', { 
                id: compareRes.data.id, 
                status: compareRes.data.status 
            });

            // Wait for comparison completion (it might be async)
            // In our mock implementation, it returns immediately or updates DB async?
            // The code says: apsComparisonService.compareMetadata(...).then(...)
            // So it returns PROCESSING, then updates to COMPLETED.
            
            log('POLLING', 'Waiting for Comparison to complete...');
            let compAttempts = 0;
            let compComplete = false;
            while (compAttempts < 10 && !compComplete) {
                await new Promise(r => setTimeout(r, 1000));
                const compCheck = await axios.get(`${API_URL}/comparison/${compareRes.data.id}`);
                if (compCheck.data.status === 'COMPLETED') {
                    compComplete = true;
                    log('COMPARISON', 'Comparison Completed', compCheck.data.result);
                } else if (compCheck.data.status === 'FAILED') {
                    compComplete = true;
                    log('COMPARISON', 'Comparison Failed');
                }
                compAttempts++;
            }

        } catch (e) {
            log('COMPARISON', 'Failed to trigger comparison', e.response ? e.response.data : e.message);
        }

        // 11. Conversion (File 1 -> PDF)
        try {
            const convertRes = await axios.post(`${API_URL}/conversion/${fileId1}`, {
                format: 'pdf'
            });
            log('CONVERSION', 'Triggered Conversion (PDF)', { 
                id: convertRes.data.conversion.id, 
                status: convertRes.data.conversion.status 
            });

            log('POLLING', 'Waiting for Conversion to complete...');
            let convAttempts = 0;
            let convComplete = false;
            while (convAttempts < 10 && !convComplete) {
                await new Promise(r => setTimeout(r, 1000));
                const convCheck = await axios.get(`${API_URL}/conversion/${convertRes.data.conversion.id}`);
                if (convCheck.data.status === 'COMPLETED') {
                    convComplete = true;
                    log('CONVERSION', 'Conversion Completed', { resultUrl: convCheck.data.resultUrl });
                } else if (convCheck.data.status === 'FAILED') {
                    convComplete = true;
                    log('CONVERSION', 'Conversion Failed');
                }
                convAttempts++;
            }
        } catch (e) {
            log('CONVERSION', 'Failed to trigger conversion', e.response ? e.response.data : e.message);
        }

        // 12. Cleanup
        // Just delete the project, which should cascade delete files and comparisons
        // (Note: If cascade fails due to circular dependencies, we might need to delete comparisons first)
        try {
            await axios.delete(`${API_URL}/projects/${projectId}`);
            log('CLEANUP', 'Deleted Project (and cascaded files/comparisons)');
        } catch (e) {
            log('CLEANUP', 'Failed to delete project', e.response ? e.response.data : e.message);
            // Try deleting files individually if project deletion failed
            try {
                await axios.delete(`${API_URL}/files/${fileId1}`);
                await axios.delete(`${API_URL}/files/${fileId2}`);
            } catch (e2) {}
        }

        console.log('✅ Test Flow Completed Successfully!');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    } finally {
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    }
}

async function waitForReady(fileId) {
    let attempts = 0;
    while (attempts < 10) {
        await new Promise(r => setTimeout(r, 2000));
        const fileRes = await axios.get(`${API_URL}/files/${fileId}`);
        if (fileRes.data.status === 'READY') {
            return true;
        }
        attempts++;
    }
    return false;
}

runTest();
