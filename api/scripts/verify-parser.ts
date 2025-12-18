
// Debugging the import of pdf-parse
const pdfLib = require('pdf-parse');
console.log('PDF Lib Type:', typeof pdfLib);
console.log('PDF Lib Keys:', Object.keys(pdfLib));

import { documentParserService } from '../src/services/document-parser.service';
import path from 'path';

async function verifyParser() {
    const pdfPath = path.resolve(__dirname, '../mock-data/TechnicalSpec.pdf');
    console.log(`🔍 Testing Parser against: ${pdfPath}`);

    try {
        console.log('📖 Reading PDF content...');
        const parsed = await documentParserService.parseDocument(pdfPath, 'application/pdf');

        console.log(`✅ Extracted Text Length: ${parsed.text.length}`);

        const specs = documentParserService.extractSpecifications(parsed.text);
        console.log(`✅ Extracted ${specs.length} Requirements`);

        // Simple verification
        if (specs.length > 5) {
            console.log('🎉 SUCCESS: Parser is working with Real PDF!');
        } else {
            console.error('⚠️ Parser returned too few results.');
        }

    } catch (error) {
        console.error('❌ Parser failed:', error);
        process.exit(1);
    }
}

verifyParser();
