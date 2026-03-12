import assert from "node:assert/strict";
import test from "node:test";

import {
  FALLBACK_SUPPORTED_FORMATS,
  isConversionSupportedByFormats,
  normalizeBatchStatus,
  normalizeSupportedFormats,
  normalizeTrackerStatus,
} from "./contracts";

test("normalizeSupportedFormats handles backend {formats} payload", () => {
  const normalized = normalizeSupportedFormats({
    formats: {
      RVT: ["PDF", "pdf", "ifc"],
      DWG: ["pdf"],
    },
  });

  assert.deepEqual(normalized.rvt, ["ifc", "pdf"]);
  assert.deepEqual(normalized.dwg, ["pdf"]);
});

test("isConversionSupportedByFormats uses source extension as key", () => {
  assert.equal(
    isConversionSupportedByFormats(FALLBACK_SUPPORTED_FORMATS, "RVT", "pdf"),
    true,
  );
  assert.equal(
    isConversionSupportedByFormats(FALLBACK_SUPPORTED_FORMATS, "DWG", "ifc"),
    false,
  );
});

test("normalizeTrackerStatus maps queue and completion states", () => {
  assert.equal(normalizeTrackerStatus("QUEUED"), "pending");
  assert.equal(normalizeTrackerStatus("PROCESSING"), "processing");
  assert.equal(normalizeTrackerStatus("COMPLETED"), "completed");
  assert.equal(normalizeTrackerStatus("FAILED"), "failed");
});

test("normalizeBatchStatus supports summary and compatibility aliases", () => {
  const fromSummary = normalizeBatchStatus({
    status: "processing",
    summary: {
      pending: 1,
      queued: 1,
      processing: 2,
      completed: 3,
      failed: 0,
    },
  });

  assert.equal(fromSummary.status, "processing");
  assert.deepEqual(fromSummary.summary, {
    pending: 2,
    processing: 2,
    completed: 3,
    failed: 0,
    total: 7,
  });

  const fromCounts = normalizeBatchStatus({
    status: "completed",
    counts: {
      pending: 0,
      queued: 0,
      processing: 0,
      completed: 4,
      failed: 1,
    },
  });

  assert.equal(fromCounts.status, "completed");
  assert.equal(fromCounts.summary.completed, 4);
  assert.equal(fromCounts.summary.failed, 1);
});
