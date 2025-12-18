import { validationService } from "../src/services/validation/validation.service";
import { SpecificationItem } from "../src/services/document-parser.service";

async function verifyValidation() {
  console.log("🔍 Testing Smart Validation Logic...\n");

  // 1. Mock Specifications
  const mockSpecs: SpecificationItem[] = [
    {
      section: "03.30",
      category: "Concrete", // Should match "Concrete", "Structural Concrete"
      property: "Compressive Strength",
      value: "35 MPa",
    },
    {
      section: "03.30",
      category: "Concrete",
      property: "Thickness",
      value: "200mm", // Should match 0.2m
    },
    {
      section: "08.11",
      category: "Doors",
      property: "Fire Rating",
      value: "60 mins",
    },
  ];

  // 2. Mock Model Elements
  const mockModel = [
    // Element A: Concrete Wall (Should Pass Correctly)
    {
      objectid: "1001",
      name: "Wall-01",
      properties: {
        "Identity Data": {
          Type: "Basic Wall: Generic - 200mm",
          Category: "Structural Concrete", // Matches "Concrete"
        },
        Structural: {
          "Compressive Strength": "35 MPa", // Exact Match
        },
        Dimensions: {
          Thickness: "0.20 m", // Unit conversion match (200mm == 0.2m)
        },
      },
    },
    // Element B: Concrete Slab (Should Fail Thickness)
    {
      objectid: "1002",
      name: "Floor-01",
      properties: {
        "Identity Data": { Category: "Concrete Floors" },
        Dimensions: { Thickness: "0.15 m" }, // 150mm != 200mm
      },
    },
    // Element C: Door (Should Ignore Concrete Specs)
    {
      objectid: "1003",
      name: "Door-01",
      properties: {
        "Identity Data": { Category: "Doors" },
        "Fire Protection": { "Fire Rating": "60 mins" }, // Pass
      },
    },
  ];

  console.log("📋 Running Validation...");
  const results = validationService.validateModel(mockSpecs, mockModel);

  // 3. Verify Results

  // Check Element A (Wall)
  const wallPassvStrength = results.find(
    (r) =>
      r.elementId === "1001" &&
      r.property === "Compressive Strength" &&
      r.status === "PASS",
  );
  const wallPassThickness = results.find(
    (r) =>
      r.elementId === "1001" &&
      r.property === "Thickness" &&
      r.status === "PASS",
  );

  // Check Element B (Floor)
  const floorFailThickness = results.find(
    (r) =>
      r.elementId === "1002" &&
      r.property === "Thickness" &&
      r.status === "FAIL",
  );

  // Check Element C (Door)
  const doorPassFire = results.find(
    (r) =>
      r.elementId === "1003" &&
      r.property === "Fire Rating" &&
      r.status === "PASS",
  );

  // Check Confusion (Door should NOT fail on Concrete specs)
  const doorFailConcrete = results.find(
    (r) => r.elementId === "1003" && r.property === "Thickness",
  );

  console.log("\n--- Results ---");
  console.log(`✅ Wall Strength Match: ${wallPassvStrength ? "PASS" : "FAIL"}`);
  console.log(
    `✅ Wall Thickness Match (Unit Conversion): ${wallPassThickness ? "PASS" : "FAIL"} (Expected 200mm == 0.20m)`,
  );
  console.log(
    `✅ Floor Thickness Mismatch: ${floorFailThickness ? "PASS" : "FAIL"} (Expected Fail)`,
  );
  console.log(`✅ Door Rating Match: ${doorPassFire ? "PASS" : "FAIL"}`);
  console.log(
    `✅ Context Awareness: ${!doorFailConcrete ? "PASS (Door ignored concrete specs)" : "FAIL (Door checked against concrete)"}`,
  );

  if (
    wallPassvStrength &&
    wallPassThickness &&
    floorFailThickness &&
    doorPassFire &&
    !doorFailConcrete
  ) {
    console.log("\n🎉 ALL SMART LOGIC CHECKS PASSED!");
  } else {
    console.log("\n❌ SOME CHECKS FAILED");
    console.log("Full Results:", JSON.stringify(results, null, 2));
  }
}

verifyValidation().catch(console.error);
