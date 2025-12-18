import { documentParserService } from "../src/services/document-parser.service";
import * as path from "path";
import * as fs from "fs";

async function analyzeMopSpec() {
  // 1. Target the Specific MOP Volume 5 PDF
  const pdfPath = path.join(
    "C:/Users/Sebastian/Proyecto DOM/PDFs Chile/Volumen_N°5_Jun.2024.pdf",
  );

  if (!fs.existsSync(pdfPath)) {
    console.error("❌ Error: MOP Volume 5 not found at", pdfPath);
    process.exit(1);
  }

  console.log(`🔍 Deep Analyzing MOP PDF: ${pdfPath}`);
  const stats = fs.statSync(pdfPath);
  console.log(`📂 File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  try {
    console.log("📖 Reading Full PDF content (this may take 10-20s)...");
    const startTime = Date.now();
    // Parse the entire document
    const result = await documentParserService.parseDocument(
      pdfPath,
      "application/pdf",
    );
    const duration = (Date.now() - startTime) / 1000;

    console.log(`✅ Parsing Completed in ${duration.toFixed(2)}s`);
    console.log(`✅ Total Characters: ${result.text.length}`);

    // 2. Deep Structural Analysis (Scanning for "5.4xx" Sections)
    console.log("⚙️ Scanning for Concrete Sections (5.4xx)...");
    const lines = result.text.split("\n");
    let concreteSectionFound = false;
    const concreteLineCount = 0;

    // Regex for MOP Section Headers (e.g. "5.401.1 GENERALIDADES")
    // MOP format is usually: 5.401, 5.402, etc.
    const sectionRegex = /^(5\.4\d{2}(?:\.\d+)?)\s+(.+)$/;

    const structure = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Normalize line for check
      // Check for "Hormigón" keyword in headers
      if (sectionRegex.test(line)) {
        const match = line.match(sectionRegex);
        if (match) {
          structure.push({
            code: match[1],
            title: match[2],
            lineIndex: i,
          });

          if (
            match[2].toLowerCase().includes("hormogón") ||
            match[2].toLowerCase().includes("hormigon")
          ) {
            console.log(`🎯 Found Concrete Section: [${match[1]}] ${match[2]}`);
            concreteSectionFound = true;
          }
        }
      }
    }

    console.log(`✅ Identified ${structure.length} Section Headers.`);

    // Sample the structure
    console.log(
      "\n--- Document Structure Sample (First 20 detected sections) ---",
    );
    structure.slice(0, 20).forEach((s) => console.log(`${s.code} ${s.title}`));

    // 3. Dump Structure for Review
    const dumpPath = path.join(__dirname, "../mock-data/MOP_Structure.txt");
    fs.writeFileSync(
      dumpPath,
      structure.map((s) => `${s.code} ${s.title}`).join("\n"),
    );
    console.log(`📄 Structure Dumped to: ${dumpPath}`);

    if (!concreteSectionFound) {
      console.warn(
        '⚠️ Warning: No explicit "Hormigón" section title found in the scan. MOP might use "Pavimentos" or other terms.',
      );
    }
  } catch (error) {
    console.error("❌ Deep Analysis Failed:", error);
    process.exit(1);
  }
}

analyzeMopSpec();
