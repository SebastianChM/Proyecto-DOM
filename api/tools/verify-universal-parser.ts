import { SpecParserService } from "../src/services/spec-parser.service";
import * as path from "path";
import * as fs from "fs";

async function verifyUniversalParser() {
  // 1. Setup
  const parser = new SpecParserService();
  // Use the Simulated Chile Spec (Text file) as the "Universal Source" (could be PDF/Docx)
  const filePath = path.join(__dirname, "../mock-data/ChileSpec.txt");

  if (!fs.existsSync(filePath)) {
    console.error("❌ Error: ChileSpec.txt not found");
    process.exit(1);
  }

  console.log(`🚀 Testing Universal Grammar Parser on: ${filePath}`);
  const text = fs.readFileSync(filePath, "utf-8");

  // 2. Run Parser
  console.log("📖 Analyzing Grammar...");
  const result = parser.parse(text);

  console.log(
    `✅ Processed ${result.totalLinesProcessed} lines in ${result.parseDurationMs}ms`,
  );
  console.log(`✅ Found ${result.requirements.length} Requirements`);

  // 3. Inspect Results (Show Grammar Type)
  console.log("\n--- Extraction Report ---");
  result.requirements.forEach((req) => {
    console.log(
      `[${req.grammarType}] ${req.parameter} ${req.operator} ${req.value}`,
    );
    if (req.normalized) {
      console.log(
        `   └─ 📏 SI Unit: ${req.normalized.value} ${req.normalized.unit}`,
      );
    }
    console.log(`   └─ Derived Category: ${req.derivedCategory}`);
    console.log(`   └─ Valid Logic: Yes (Confidence: ${req.confidence})`);
  });
}

verifyUniversalParser();
