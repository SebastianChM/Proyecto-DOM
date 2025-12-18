
import { documentParserService } from '../src/services/document-parser.service';
import * as path from 'path';
import * as fs from 'fs';

async function verifyRealSpec() {
    const pdfPath = path.join(__dirname, '../mock-data/RealSpec.pdf');

    if (!fs.existsSync(pdfPath)) {
        console.error('❌ Error: RealSpec.pdf not found at', pdfPath);
        process.exit(1);
    }

    console.log(`🔍 Testing Parser against REAL PDF: ${pdfPath}`);
    const stats = fs.statSync(pdfPath);
    console.log(`📂 File Size: ${(stats.size / 1024).toFixed(2)} KB`);

    if (stats.size < 1000) {
        console.error('❌ File is suspiciously small. Might be an error page.');
        console.log('Preview:', fs.readFileSync(pdfPath, 'utf8').substring(0, 200));
        process.exit(1);
    }

    try {
        console.log('📖 Reading PDF content...');
        const startTime = Date.now();
        const result = await documentParserService.parseDocument(pdfPath, 'application/pdf');
        const duration = (Date.now() - startTime) / 1000;

        console.log(`✅ Parsing Completed in ${duration.toFixed(2)}s`);
        console.log(`✅ Extracted Text Length: ${result.text.length} characters`);
        console.log(`✅ Metadata: Pages=${result.metadata?.pages}`);

        // Dump raw text for analysis
        const dumpPath = path.join(__dirname, '../mock-data/RealSpec_Raw.txt');
        fs.writeFileSync(dumpPath, result.text);
        console.log(`📄 Raw text dumped to: ${dumpPath}`);

        // Extract Specifications using the new Smart logic
        console.log('⚙️ Extraction Specifications (Smart Logic)...');
        const specs = documentParserService.extractSpecifications(result.text);
        console.log(`✅ Extracted ${specs.length} structured requirements`);

        // Preview some extraction
        if (specs.length > 0) {
            console.log('\n--- Sample Extractions ---');
            specs.slice(0, 10).forEach(s => {
                console.log(`[${s.section}] ${s.category} -> ${s.property}: ${s.value}`);
            });
        } else {
            console.warn('⚠️ No structured specs found. This might be due to different formatting in the real PDF.');
            console.log('First 500 chars of text:', result.text.substring(0, 500));
        }

    } catch (error) {
        console.error('❌ Parsing Failed:', error);
        process.exit(1);
    }
}

verifyRealSpec();
