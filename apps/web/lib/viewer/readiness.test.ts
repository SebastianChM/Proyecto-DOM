import assert from "node:assert/strict";
import test from "node:test";

import {
  getViewerReadinessMessage,
  isFileLifecycleActive,
  isViewerReady,
  normalizeFileStatus,
} from "./readiness.ts";

test("normalizeFileStatus canonicalizes values", () => {
  assert.equal(normalizeFileStatus(" ready "), "READY");
  assert.equal(normalizeFileStatus(undefined), "UNKNOWN");
});

test("isViewerReady requires READY status and urn", () => {
  assert.equal(isViewerReady("READY", "urn:abc"), true);
  assert.equal(isViewerReady("READY", null), false);
  assert.equal(isViewerReady("PROCESSING", "urn:abc"), false);
});

test("isFileLifecycleActive includes upload and translation states", () => {
  assert.equal(isFileLifecycleActive("UPLOADING"), true);
  assert.equal(isFileLifecycleActive("UPLOADED"), true);
  assert.equal(isFileLifecycleActive("TRANSLATING"), true);
  assert.equal(isFileLifecycleActive("READY"), false);
});

test("getViewerReadinessMessage returns contextual guidance", () => {
  assert.match(getViewerReadinessMessage("UPLOADING"), /upload/i);
  assert.match(getViewerReadinessMessage("QUEUED"), /queued/i);
  assert.match(getViewerReadinessMessage("TRANSLATING"), /translated|translation/i);
  assert.match(getViewerReadinessMessage("FAILED"), /failed/i);
});
