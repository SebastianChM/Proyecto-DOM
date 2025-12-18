import { SupremacyEngineService } from "../src/services/supremacy-engine.service";

async function testSupremacy() {
  console.log("--- Testing Supremacy Engine (Phase 2) ---");

  const engine = new SupremacyEngineService();

  // Mock Data
  const specRules = [
    {
      id: "s1",
      parameter: "Fire Rating",
      value: "60 min",
      derivedCategory: "Walls",
      source: "Spec",
    },
    {
      id: "s2",
      parameter: "Concrete Strength",
      value: "30 MPa",
      derivedCategory: "Structure",
      source: "Spec",
    },
  ];

  const normRules = [
    {
      id: "n1",
      parameter: "Fire Rating",
      value: "120 min",
      derivedCategory: "Walls",
      source: "Normative",
    }, // Higher!
    {
      id: "n2",
      parameter: "Seismic Factor",
      value: "0.4g",
      derivedCategory: "General",
      source: "Normative",
    }, // New rule
  ];

  console.log(
    "Spec Rules:",
    specRules.map((r) => `${r.parameter}: ${r.value}`),
  );
  console.log(
    "Norm Rules:",
    normRules.map((r) => `${r.parameter}: ${r.value}`),
  );

  const activeRules = engine.resolveActiveRules(specRules, normRules);

  console.log("\n--- Active Rules (Resolution) ---");
  activeRules.forEach((r) => {
    let status = "";
    if (r.source === "Merged")
      status = `[CONFLICT RESOLVED] ${r.conflictDescription}`;
    else if (r.source === "Normative") status = `[ADDED BY NORM]`;
    else status = `[SPEC ORIGINAL]`;

    console.log(`Rule: ${r.parameter}`);
    console.log(`  Value: ${r.value}`);
    console.log(`  Info: ${status}`);
    console.log("---");
  });
}

testSupremacy();
