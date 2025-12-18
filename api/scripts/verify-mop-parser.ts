
import { MopParserService } from '../src/services/mop-parser.service';
import { documentParserService } from '../src/services/document-parser.service';
import * as path from 'path';
import * as fs from 'fs';

async function verifyMopParser() {
    // 1. Setup
    const mopParser = new MopParserService();
    const pdfPath = path.join('C:/Users/Sebastian/Proyecto DOM/PDFs Chile/Volumen_N°5_Jun.2024.pdf');

    if (!fs.existsSync(pdfPath)) {
        console.error('❌ PDF not found');
        process.exit(1);
    }

    console.log(`🚀 Starting Professional MOP Verification on 16MB File...`);

    // 2. Extract Raw Text (Heavy Lift)
    console.log('📖 Extracting Text layers...');
    const result = await documentParserService.parseDocument(pdfPath, 'application/pdf');
    console.log(`✅ Text Extracted: ${result.text.length} chars`);

    // 3. Run MOP Parser
    console.log('⚙️ Running MOP Structural Analysis...');
    const startTime = Date.now();
    const allSections = mopParser.parse(result.text);
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ Analyzed ${allSections.length} Sections in ${duration.toFixed(3)}s`);

    // 4. Filter for Structural (Concrete)
    const structuralSections = mopParser.filterByDiscipline(allSections, 'STRUCTURAL');
    console.log(`🏗️  Structural Sections Found: ${structuralSections.length}`);

    // 5. Audit Requirements
    let totalReqs = 0;
    structuralSections.forEach(s => totalReqs += s.requirements.length);
    console.log(`🔎 Total "Requirements" Detected: ${totalReqs}`);

    // 6. Preview
    console.log('\n--- Sample Structural Requirements ---');
    const sectionsWithReqs = structuralSections.filter(s => s.requirements.length > 0);
    sectionsWithReqs.slice(0, 5).forEach(s => {
        console.log(`\n[${s.code}] ${s.title}`);
        s.requirements.slice(0, 3).forEach(r => {
            console.log(`   - ${r.parameter}: ${r.value}`);
        });
    });

}

verifyMopParser();
