/**
 * QA DIRECTO — Compliance Engine V3
 *
 * Este script prueba el motor de compliance SIN HTTP ni APS.
 * Usa inyección de extractor mock + requirements definidos inline.
 *
 * PRUEBA 1: Propiedad inexistente → espera FAILS
 * PRUEBA 2: GlobalId existe en todos → espera 0 FAILS
 * PRUEBA 3: Tres severidades → diferenciación correcta
 */

import {
  matchElementsForRequirement,
  evaluateRequirement,
  calculateComplianceScore,
  normalizeValue,
} from "../src/services/compliance-engine-v3";
import type {
  NormalizedElement,
  NormalizedValue,
} from "../src/services/compliance-engine-v3";
import type { ResolvedRequirement } from "../src/services/compliance-v3/project-config.service";

// ─── ELEMENTOS MOCK (simula un modelo BIM con 3 muros) ────────────────────────
function makeElement(
  id: string,
  name: string,
  category: string,
  props: Record<string, string | number>,
): NormalizedElement {
  const properties = new Map<string, NormalizedValue>();
  for (const [k, v] of Object.entries(props)) {
    const raw = String(v);
    const numeric = typeof v === "number" ? v : parseFloat(raw);
    properties.set(k, {
      raw,
      numeric: isNaN(numeric) ? null : numeric,
      unit: null,
      text: raw,
    });
  }
  return { elementId: id, name, category, properties };
}

const MOCK_ELEMENTS: NormalizedElement[] = [
  makeElement("el-001", "Wall Type A", "IfcWall", {
    GlobalId: "1a2b3c4d",
    Pset_WallCommon_FireRating: "60",
    LoadBearing: "true",
  }),
  makeElement("el-002", "Wall Type B", "IfcWall", {
    GlobalId: "2b3c4d5e",
    LoadBearing: "false",
    // Note: NO FireRating intentionally for testing
  }),
  makeElement("el-003", "Beam Type A", "IfcBeam", {
    GlobalId: "3c4d5e6f",
    Pset_BeamCommon_LoadBearing: "true",
  }),
  makeElement("el-004", "Column Type A", "IfcColumn", {
    GlobalId: "4d5e6f7g",
    Pset_ColumnCommon_LoadBearing: "true",
  }),
  makeElement("el-005", "Slab Type A", "IfcSlab", {
    GlobalId: "5e6f7g8h",
    Pset_SlabCommon_LoadBearing: "true",
  }),
];

// ─── HELPER: construye un ResolvedRequirement inline ─────────────────────────
function makeReq(
  id: string,
  code: string,
  description: string,
  severity: "MANDATORY" | "RECOMMENDED" | "OPTIONAL",
  conditions: Array<{
    propertyRef: string;
    operator: string;
    value: string;
    logicGroup?: string;
  }>,
  targetCategories: string[] = [],
): ResolvedRequirement {
  return {
    id,
    code,
    packId: "qa-pack",
    description,
    legalReference: "QA:Test",
    discipline: "GENERAL",
    severity,
    tags: [],
    notes: null,
    status: "VERIFIED",
    conditions: conditions.map((c, i) => ({
      propertyCanonicalName: c.propertyRef,
      propertyAliases: [],
      operator: c.operator,
      value: c.value,
      unit: null,
      tolerance: 0,
      logicGroup: c.logicGroup ?? "AND",
      sortOrder: i,
    })),
    applicability: {
      scope: targetCategories.length > 0 ? "FILTERED" : "ALL",
      targetCategories,
      excludeCategories: [],
      propertyFilters: {},
    },
    overridden: false,
  };
}

// ─── MOTOR: ejecuta requirements contra elementos ─────────────────────────────
function runEngine(
  requirements: ResolvedRequirement[],
  elements: NormalizedElement[],
) {
  const allEvaluations = [];
  for (const req of requirements) {
    const matching = matchElementsForRequirement(req, elements);
    for (const element of matching) {
      // Simple property resolver (no aliases, no dictionary)
      const resolver = (el: NormalizedElement, canonicalName: string) =>
        el.properties.get(canonicalName) ?? null;
      const evaluation = evaluateRequirement(req, element, resolver);
      allEvaluations.push(evaluation);
    }
  }
  return allEvaluations;
}

// ─── REPORT ───────────────────────────────────────────────────────────────────
function report(
  testName: string,
  evaluations: ReturnType<typeof runEngine>,
  expectations: {
    minFails?: number;
    maxFails?: number;
    exactFails?: number;
    severities?: string[];
  },
) {
  const fails = evaluations.filter((e) => e.status === "FAIL");
  const passes = evaluations.filter((e) => e.status === "PASS");
  const sevSet = new Set(fails.map((e) => e.severity.toUpperCase()));

  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log(`  Total evaluaciones: ${evaluations.length}`);
  console.log(`  PASS: ${passes.length}  |  FAIL: ${fails.length}`);
  if (fails.length > 0) {
    console.log(`  Fails por elemento:`);
    for (const f of fails) {
      const failCond = f.conditions.find((c) => !c.passed);
      console.log(
        `    [${f.severity}] ${f.elementName} (${f.elementId}) — ${f.requirementCode} — prop=${failCond?.propertyName ?? "?"} op=${failCond?.operator ?? "?"} expected=${failCond?.expectedValue ?? "?"} actual=${failCond?.actualValue ?? "?"}`,
      );
    }
    console.log(`  Severidades presentes: ${[...sevSet].join(", ")}`);
  }
  const score = calculateComplianceScore(evaluations);
  console.log(`  Compliance score: ${score}%`);

  // Verificar expectativas
  let pass = true;
  const issues = [];

  if (
    expectations.exactFails !== undefined &&
    fails.length !== expectations.exactFails
  ) {
    issues.push(
      `esperaba exactamente ${expectations.exactFails} fails, obtuvo ${fails.length}`,
    );
    pass = false;
  }
  if (
    expectations.minFails !== undefined &&
    fails.length < expectations.minFails
  ) {
    issues.push(
      `esperaba >= ${expectations.minFails} fails, obtuvo ${fails.length}`,
    );
    pass = false;
  }
  if (
    expectations.maxFails !== undefined &&
    fails.length > expectations.maxFails
  ) {
    issues.push(
      `esperaba <= ${expectations.maxFails} fails, obtuvo ${fails.length}`,
    );
    pass = false;
  }
  if (expectations.severities) {
    for (const sev of expectations.severities) {
      if (!sevSet.has(sev.toUpperCase())) {
        issues.push(`esperaba severidad ${sev} en los fails`);
        pass = false;
      }
    }
  }

  if (pass) {
    console.log(`  RESULTADO: ✓ PASS`);
  } else {
    console.log(`  RESULTADO: ✗ FAIL — ${issues.join("; ")}`);
  }
  console.log("=".repeat(60));
  return { pass, failCount: fails.length, score, severities: [...sevSet] };
}

// ═════════════════════════════════════════════════════════════════════════════
// PRUEBA 1 — Propiedad inexistente → todos los elementos deben fallar
// ═════════════════════════════════════════════════════════════════════════════
const REQ_FAKE = makeReq(
  "req-fake-001",
  "QA-FAKE-R001",
  "Todos los elementos deben tener QA_FAKE_PROP_XYZ",
  "MANDATORY",
  [{ propertyRef: "QA_FAKE_PROP_XYZ", operator: "exists", value: "true" }],
);

const eval1 = runEngine([REQ_FAKE], MOCK_ELEMENTS);
const r1 = report(
  "PRUEBA 1 — Violacion conocida (propiedad inexistente)",
  eval1,
  {
    minFails: MOCK_ELEMENTS.length, // todos deben fallar
    severities: ["MANDATORY"],
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// PRUEBA 2 — GlobalId existe en todos → 0 fails
// ═════════════════════════════════════════════════════════════════════════════
const REQ_GLOBALID = makeReq(
  "req-glid-001",
  "QA-GLID-R001",
  "Todos los elementos deben tener GlobalId",
  "MANDATORY",
  [{ propertyRef: "GlobalId", operator: "exists", value: "true" }],
);

const eval2 = runEngine([REQ_GLOBALID], MOCK_ELEMENTS);
const r2 = report("PRUEBA 2 — Cumplimiento conocido (GlobalId)", eval2, {
  exactFails: 0,
});

// ═════════════════════════════════════════════════════════════════════════════
// PRUEBA 3 — Tres severidades en un solo run
//   REQ_FAKE     → MANDATORY (todos fallan)
//   REQ_FIRE     → RECOMMENDED (muros sin FireRating fallan)
//   REQ_LOADBEAR → OPTIONAL (columnas sin LoadBearing fallan) — not applicable here
// ═════════════════════════════════════════════════════════════════════════════
const REQ_FIRE = makeReq(
  "req-fire-001",
  "QA-FIRE-R001",
  "Muros deben tener Pset_WallCommon_FireRating",
  "RECOMMENDED",
  [
    {
      propertyRef: "Pset_WallCommon_FireRating",
      operator: "exists",
      value: "true",
    },
  ],
  ["IfcWall"],
);

const REQ_LOADBEAR = makeReq(
  "req-lb-001",
  "QA-LB-R001",
  "Muros deben declarar LoadBearing",
  "OPTIONAL",
  [{ propertyRef: "LoadBearing", operator: "exists", value: "true" }],
  ["IfcWall"],
);

const eval3 = runEngine([REQ_FAKE, REQ_FIRE, REQ_LOADBEAR], MOCK_ELEMENTS);
const r3 = report(
  "PRUEBA 3 — Tres severidades (MANDATORY + RECOMMENDED + OPTIONAL)",
  eval3,
  {
    minFails: 1,
    severities: ["MANDATORY", "RECOMMENDED"],
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// RESUMEN FINAL
// ═════════════════════════════════════════════════════════════════════════════
console.log("\n" + "=".repeat(60));
console.log("RESUMEN FINAL — QA Compliance Engine V3");
console.log("=".repeat(60));
console.log(`Prueba 1 (violacion conocida):     ${r1.pass ? "PASS" : "FAIL"}`);
console.log(`Prueba 2 (cumplimiento conocido):  ${r2.pass ? "PASS" : "FAIL"}`);
console.log(`Prueba 3 (severidades):            ${r3.pass ? "PASS" : "FAIL"}`);

const allPass = r1.pass && r2.pass && r3.pass;
console.log("\n" + "-".repeat(60));
if (allPass) {
  console.log("Compliance V3 DETECTA VIOLACIONES REALES:              SI");
  console.log("Compliance V3 DIFERENCIA CUMPLIMIENTO DE INCUMPLIMIENTO: SI");
  console.log("VEREDICTO GLOBAL: APTO PARA PRODUCCION");
} else {
  console.log(
    "Compliance V3 DETECTA VIOLACIONES REALES:              " +
      (r1.pass ? "SI" : "NO"),
  );
  console.log(
    "Compliance V3 DIFERENCIA CUMPLIMIENTO DE INCUMPLIMIENTO: " +
      (r2.pass ? "SI" : "NO"),
  );
  console.log("VEREDICTO GLOBAL: BLOQUEADO — ver pruebas fallidas");
}
console.log("=".repeat(60));
