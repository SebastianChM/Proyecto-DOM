import { HierarchicalSpecProcessor } from "../src/services/hierarchical-spec-processor";

const processor = new HierarchicalSpecProcessor();

// Simulate the input that caused the issue (Separate lines without punctuation)
const testContent = [
  { text: "Generic 300: más intuitiva", page: 1 },
  { text: "Testing automatizado: No hay tests", page: 1 },
  { text: "Concrete Must Be: 30 MPa", page: 1 }, // Control case (Should pass)
  { text: "Titulo: Introducción", page: 1 }, // Control case (Should fail)
];

console.log("Testing Integrity Filter...");
const reqs = processor.processTree([
  {
    id: "test-node-1",
    title: "Test Section",
    section: "1",
    children: [],
    content: testContent,
  },
]);

console.log("Extracted Requirements:", JSON.stringify(reqs, null, 2));

if (reqs.length === 1 && reqs[0].value.includes("30")) {
  console.log("SUCCESS: Only valid technical requirement extracted.");
} else {
  console.log("FAILURE: Garbage requirements extracted.");
}
