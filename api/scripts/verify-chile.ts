
import { documentParserService } from '../src/services/document-parser.service';
import * as path from 'path';
import * as fs from 'fs';

async function verifyChileSpec() {
    const filePath = path.join(__dirname, '../mock-data/ChileSpec.txt');

    if (!fs.existsSync(filePath)) {
        console.error('❌ Error: ChileSpec.txt not found at', filePath);
        process.exit(1);
    }

    console.log(`🔍 Testing Parser against CHILEAN TEXT: ${filePath}`);
    const stats = fs.statSync(filePath);
    console.log(`📂 File Size: ${(stats.size / 1024).toFixed(2)} KB`);

    try {
        const result = await documentParserService.parseDocument(filePath, 'text/plain');
        console.log(`✅ Extracted Text Length: ${result.text.length} characters`);

        // Dump raw text
        const dumpPath = path.join(__dirname, '../mock-data/ChileSpec_Raw.txt');
        fs.writeFileSync(dumpPath, result.text);
        console.log(`📄 Raw text dumped to: ${dumpPath}`);

        // Extract Specifications
        console.log('⚙️ Extraction Specifications (Smart Logic)...');
        const specs = documentParserService.extractSpecifications(result.text);
        console.log(`✅ Extracted ${specs.length} structured requirements`);

        if (specs.length > 0) {
            console.log('\n--- Sample Extractions ---');
            specs.slice(0, 10).forEach(s => {
                console.log(`[${s.section}] ${s.category} -> ${s.property}: ${s.value}`);
            });
        } else {
            console.warn('⚠️ No structured specs found. Spanish formatting might be differentiating.');
            console.log('First 500 chars:', result.text.substring(0, 500));
        }

    } catch (error) {
        console.error('❌ Parsing Failed:', error);
        process.exit(1);
    }
}

verifyChileSpec();
