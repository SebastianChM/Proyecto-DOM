const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/app/dashboard/projects/[id]/page.tsx');

try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const requiredImports = [
        'import { ApsBrowser } from "@/components/ApsBrowser"',
        'import { useUser } from "@/context/UserContext"',
        'import { showError } from "@/lib/error-handler"',
        'import { ViewerModal } from "@/components/ViewerModal"'
    ];

    let allFound = true;
    requiredImports.forEach(imp => {
        if (!content.includes(imp)) {
            console.error(`❌ Missing import: ${imp}`);
            allFound = false;
        } else {
            console.log(`✅ Found import: ${imp}`);
        }
    });

    if (allFound) {
        console.log('All required imports are present.');
    } else {
        console.error('Some imports are missing.');
        process.exit(1);
    }

} catch (err) {
    console.error('Error reading file:', err);
    process.exit(1);
}
