import { HierarchicalParserService } from "../src/services/hierarchical-parser.service";
import { HierarchicalSpecProcessor } from "../src/services/hierarchical-spec-processor";

// Mocking the PDFExtract structure locally since we can't easily upload a PDF file for this script to run in the cloud environment without manual upload.
// We will mock the 'buildTree' or just the logic if possible, but let's try to simulate the data 'parse' would receive.

const mockPdfData = {
  pages: [
    {
      content: [
        { str: "1.0 STRUCTURE", x: 10, y: 10 },
        { str: "General requirements for structure.", x: 10, y: 20 },

        { str: "1.1 CONCRETE", x: 10, y: 50 },
        { str: "All concrete shall be reinforced.", x: 10, y: 60 },

        { str: "1.1.1 STRENGTH", x: 20, y: 80 }, // Indented logic or just numbering
        { str: "Compressive strength shall be 30 MPa.", x: 20, y: 90 },

        { str: "1.2 STEEL", x: 10, y: 120 },
        { str: "Steel grade must be A36.", x: 10, y: 130 },
      ],
    },
  ],
};

async function testHierarchy() {
  console.log("--- Testing Hierarchical Parser Logic ---");

  // We need to access the private method 'buildTree' or modify the service to accept data.
  // For this test, I'll instantiate the service and cast it to any to access the private method,
  // or better, I will assume the service has a public method 'processData' if I refactor it.
  // Let's modify the service slightly to be more testable or just use the public parse if we had a file.

  // Since I can't easily refactor in this step without a separate call,
  // I will duplicate the logic here for the 'Test' to ensure the ALGORITHM works.
  // If this works, the Service will work.

  const parser = new HierarchicalParserService();
  // @ts-ignore
  const tree = parser.buildTree(mockPdfData);

  console.log("1. Tree Structure Generated:");
  console.log(JSON.stringify(tree, null, 2));

  const processor = new HierarchicalSpecProcessor();
  const requirements = processor.processTree(tree);

  console.log("\n2. Requirements Extracted with Context:");
  requirements.forEach((r) => {
    console.log(
      `[${r.derivedCategory}] ${r.originalText} (Context: ${r.section})`,
    );
  });
}

testHierarchy();
