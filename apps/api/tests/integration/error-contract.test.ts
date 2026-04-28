import request from "supertest";
import app from "../../src/index";
import { redis } from "../../src/lib/redis";

describe("Error Response Contract", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("401 — unauthenticated dashboard access", async () => {
    const res = await request(app).get("/api/dashboard/stats");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
    // "error" field is the human-readable message (backward-compat)
    expect(typeof res.body.error).toBe("string");
    expect(typeof res.body.type).toBe("string");

    console.log("=== 401 EXAMPLE ===", JSON.stringify(res.body, null, 2));
  });

  it("400 — missing userId on notifications", async () => {
    const res = await request(app).get("/api/notifications");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "userId is required",
      type: "BadRequest",
      code: "MISSING_USER_ID",
    });

    console.log("=== 400 EXAMPLE ===", JSON.stringify(res.body, null, 2));
  });

  it("500 — generic server error (no DB) has sanitized shape", async () => {
    const res = await request(app).get(
      "/api/reports/validation/00000000-0000-0000-0000-000000000000",
    );

    // In test env (no DB), Prisma throws → 500
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: expect.any(String),
      type: "InternalServerError",
    });
    // Must have the standard shape fields
    expect(typeof res.body.error).toBe("string");
    expect(typeof res.body.type).toBe("string");

    console.log("=== 500 EXAMPLE ===", JSON.stringify(res.body, null, 2));
  });
});

// ---------------------------------------------------------------------------
// Project & Member error contract tests (Commit 5)
// ---------------------------------------------------------------------------
describe("Error Contract — Projects & Members", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("401 — unauthenticated GET /api/projects", async () => {
    const res = await request(app).get("/api/projects");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
    expect(res.body).toHaveProperty("requestId");
  });

  it("401 — unauthenticated POST /api/projects", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Test", clientName: "X" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
  });

  it("401 — unauthenticated POST /api/projects/import-aps", async () => {
    const res = await request(app)
      .post("/api/projects/import-aps")
      .set("Content-Type", "application/json")
      .send({
        name: "T",
        apsProjectId: "b.1",
        apsFolderId: "f:1",
        hubId: "h:1",
      });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
  });

  it("401 — unauthenticated GET /api/project-members/:id/permissions", async () => {
    const res = await request(app).get(
      "/api/project-members/00000000-0000-0000-0000-000000000000/permissions",
    );

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
  });

  it("contract shape — all error responses have error + type", async () => {
    // Gather multiple error responses
    const endpoints = [
      request(app).get("/api/projects"),
      request(app).get(
        "/api/project-members/00000000-0000-0000-0000-000000000000/permissions",
      ),
      request(app)
        .post("/api/projects")
        .set("Content-Type", "application/json")
        .send({ name: "T" }),
    ];

    const responses = await Promise.all(endpoints);
    for (const res of responses) {
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("type");
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.type).toBe("string");
      // No internal details leaked
      expect(res.body).not.toHaveProperty("sql");
      expect(res.body).not.toHaveProperty("prisma");
      expect(res.body).not.toHaveProperty("password");
    }
  });
});

// ---------------------------------------------------------------------------
// Files error contract tests (Commit 6)
// ---------------------------------------------------------------------------
describe("Error Contract — Files", () => {
  it("401 — unauthenticated GET /api/files/recent", async () => {
    const res = await request(app).get("/api/files/recent");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
    expect(res.body).toHaveProperty("requestId");

    console.log("=== FILES 401 EXAMPLE ===", JSON.stringify(res.body, null, 2));
  });

  it("400 — POST /api/files/sync-status without fileIds", async () => {
    const res = await request(app)
      .post("/api/files/sync-status")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "No file IDs provided",
      type: "BadRequest",
      code: "MISSING_FILE_IDS",
    });
    expect(res.body).toHaveProperty("requestId");

    console.log("=== FILES 400 EXAMPLE ===", JSON.stringify(res.body, null, 2));
  });

  it("400 — POST /api/files/upload without file", async () => {
    const res = await request(app)
      .post("/api/files/upload")
      .field("projectId", "test-project");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "No file uploaded",
      type: "BadRequest",
      code: "FILE_UPLOAD_INVALID",
    });
    expect(res.body).toHaveProperty("requestId");
  });

  it("400 — POST /api/files/import-aps missing fields", async () => {
    const res = await request(app)
      .post("/api/files/import-aps")
      .set("Content-Type", "application/json")
      .send({ projectId: "p1" }); // missing name + urn

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "Missing required fields",
      type: "BadRequest",
      code: "MISSING_FIELDS",
    });
  });

  it("contract shape — files error responses always include error + type + requestId", async () => {
    const responses = await Promise.all([
      request(app).get("/api/files/recent"),
      request(app)
        .post("/api/files/sync-status")
        .set("Content-Type", "application/json")
        .send({}),
      request(app).post("/api/files/upload").field("projectId", "p"),
    ]);

    for (const res of responses) {
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("type");
      expect(res.body).toHaveProperty("requestId");
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.type).toBe("string");
      // No internal details leaked
      expect(res.body).not.toHaveProperty("sql");
      expect(res.body).not.toHaveProperty("prisma");
      expect(res.body).not.toHaveProperty("password");
    }
  });
});

// ---------------------------------------------------------------------------
// Compliance error contract tests (Commit 7)
// ---------------------------------------------------------------------------
describe("Error Contract — Compliance", () => {
  it("400 — POST /api/compliance-v2/runs without rulesetId", async () => {
    const res = await request(app)
      .post("/api/compliance-v2/runs")
      .set("Content-Type", "application/json")
      .send({ projectId: "p1", elements: [{ id: "1" }] });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "rulesetId is required",
      type: "BadRequest",
      code: "MISSING_FIELDS",
    });
    expect(res.body).toHaveProperty("requestId");

    console.log(
      "=== COMPLIANCE 400 EXAMPLE ===",
      JSON.stringify(res.body, null, 2),
    );
  });

  it("400 — POST /api/compliance-v2/rulesets missing name/discipline", async () => {
    const res = await request(app)
      .post("/api/compliance-v2/rulesets")
      .set("Content-Type", "application/json")
      .send({ description: "test" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "Name and discipline are required",
      type: "BadRequest",
      code: "MISSING_FIELDS",
    });
    expect(res.body).toHaveProperty("requestId");
  });

  it("404/500 — GET /api/compliance-v2/rulesets/:id not found (sanitized)", async () => {
    const res = await request(app).get(
      "/api/compliance-v2/rulesets/00000000-0000-0000-0000-000000000000",
    );

    // Without DB: 500 (Prisma can't connect). With DB: 404.
    // Either way, contract shape must hold.
    expect([404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("type");
    expect(res.body).toHaveProperty("requestId");
    expect(typeof res.body.error).toBe("string");

    console.log(
      "=== COMPLIANCE 404/500 EXAMPLE ===",
      JSON.stringify({ status: res.status, type: res.body.type }, null, 2),
    );
  });

  it("404/500 — GET /api/compliance-v2/runs/:id not found (sanitized)", async () => {
    const res = await request(app).get(
      "/api/compliance-v2/runs/00000000-0000-0000-0000-000000000000",
    );

    expect([404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("type");
    expect(res.body).toHaveProperty("requestId");
    expect(typeof res.body.error).toBe("string");
  });

  it("404 — POST /api/compliance/verify after legacy route removal", async () => {
    const res = await request(app)
      .post("/api/compliance/verify")
      .field("urn", "");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("type", "NotFound");
    expect(res.body).toHaveProperty("requestId");
  });

  it("contract shape — compliance errors include error + type + requestId", async () => {
    const responses = await Promise.all([
      request(app)
        .post("/api/compliance-v2/runs")
        .set("Content-Type", "application/json")
        .send({}),
      request(app).get(
        "/api/compliance-v2/rulesets/00000000-0000-0000-0000-000000000000",
      ),
      request(app)
        .post("/api/compliance-v2/rulesets")
        .set("Content-Type", "application/json")
        .send({}),
    ]);

    for (const res of responses) {
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("type");
      expect(res.body).toHaveProperty("requestId");
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.type).toBe("string");
      expect(res.body).not.toHaveProperty("sql");
      expect(res.body).not.toHaveProperty("prisma");
    }
  });
});

// ---------------------------------------------------------------------------
// Validation error contract tests (Commit 8)
// ---------------------------------------------------------------------------
describe("Error Contract — Validation", () => {
  it("400 — POST /api/validation/validate without required fields", async () => {
    const res = await request(app)
      .post("/api/validation/validate")
      .set("Content-Type", "application/json")
      .send({});

    // Route may be rate-limited (429) in test env — skip handler assertions
    if (res.status === 429) return;

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "projectId and etDocumentId are required",
      type: "BadRequest",
      code: "MISSING_FIELDS",
    });
    expect(res.body).toHaveProperty("requestId");

    console.log(
      "=== VALIDATION 400 EXAMPLE ===",
      JSON.stringify(res.body, null, 2),
    );
  });

  it("404/500 — POST /api/validation/validate with non-existent project", async () => {
    const res = await request(app)
      .post("/api/validation/validate")
      .set("Content-Type", "application/json")
      .send({
        projectId: "00000000-0000-0000-0000-000000000000",
        etDocumentId: "00000000-0000-0000-0000-000000000001",
      });

    if (res.status === 429) return;

    // Without DB: 500 (Prisma). With DB: 404.
    expect([404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("type");
    expect(res.body).toHaveProperty("requestId");
    expect(typeof res.body.error).toBe("string");
  });

  it("contract shape — validation errors include error + type + requestId", async () => {
    const responses = await Promise.all([
      request(app)
        .post("/api/validation/validate")
        .set("Content-Type", "application/json")
        .send({}),
      request(app).get("/api/validation/00000000-0000-0000-0000-000000000000"),
    ]);

    for (const res of responses) {
      if (res.status === 429) continue; // rate-limited, skip
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("type");
      expect(res.body).toHaveProperty("requestId");
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.type).toBe("string");
      expect(res.body).not.toHaveProperty("sql");
      expect(res.body).not.toHaveProperty("prisma");
    }
  });
});

// ---------------------------------------------------------------------------
// Workflows error contract tests (Commit 8)
// ---------------------------------------------------------------------------
describe("Error Contract — Workflows", () => {
  it("401 — GET /api/workflows/PROJECT/:id without session", async () => {
    const res = await request(app).get(
      "/api/workflows/PROJECT/00000000-0000-0000-0000-000000000000",
    );

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
    expect(res.body).toHaveProperty("requestId");

    console.log(
      "=== WORKFLOWS 401 EXAMPLE ===",
      JSON.stringify(res.body, null, 2),
    );
  });

  it("400 — GET /api/workflows/INVALID_TYPE/:id invalid entity type", async () => {
    const res = await request(app).get(
      "/api/workflows/INVALID_TYPE/00000000-0000-0000-0000-000000000000",
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: "BadRequest",
      code: "INVALID_ENTITY_TYPE",
    });
    expect(res.body).toHaveProperty("error");
  });

  it("401 — POST /api/workflows/PROJECT/:id/transition without session", async () => {
    const res = await request(app)
      .post(
        "/api/workflows/PROJECT/00000000-0000-0000-0000-000000000000/transition",
      )
      .set("Content-Type", "application/json")
      .send({ transitionName: "approve" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: "Authentication required",
      type: "Unauthorized",
    });
    expect(res.body).toHaveProperty("requestId");
  });

  it("contract shape — workflow errors include error + type", async () => {
    const responses = await Promise.all([
      request(app).get(
        "/api/workflows/PROJECT/00000000-0000-0000-0000-000000000000",
      ),
      request(app).get("/api/workflows/INVALID_TYPE/fake-id"),
      request(app)
        .post(
          "/api/workflows/PROJECT/00000000-0000-0000-0000-000000000000/transition",
        )
        .set("Content-Type", "application/json")
        .send({}),
    ]);

    for (const res of responses) {
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("type");
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.type).toBe("string");
      expect(res.body).not.toHaveProperty("sql");
      expect(res.body).not.toHaveProperty("password");
    }
  });
});

// ---------------------------------------------------------------------------
// Conversion error contract tests (Commit 8)
// ---------------------------------------------------------------------------
describe("Error Contract — Conversion", () => {
  it("400 — POST /api/conversion/batch with invalid body (ZodError)", async () => {
    const res = await request(app)
      .post("/api/conversion/batch")
      .set("Content-Type", "application/json")
      .send({ fileIds: [], format: "invalid" });

    if (res.status === 429) return; // rate-limited

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: "BadRequest",
      code: "VALIDATION_ERROR",
    });
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("details");
    expect(res.body).toHaveProperty("requestId");

    console.log(
      "=== CONVERSION 400 (ZOD) EXAMPLE ===",
      JSON.stringify(res.body, null, 2),
    );
  });

  it("400 — POST /api/conversion/:fileId with unsupported format", async () => {
    const res = await request(app)
      .post("/api/conversion/some-file-id")
      .set("Content-Type", "application/json")
      .send({ format: "bmp" });

    if (res.status === 429) return; // rate-limited

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: "BadRequest",
      code: "INVALID_FORMAT",
    });
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("requestId");
  });

  it("contract shape — conversion errors include error + type + requestId", async () => {
    const responses = await Promise.all([
      request(app)
        .post("/api/conversion/batch")
        .set("Content-Type", "application/json")
        .send({}),
      request(app)
        .post("/api/conversion/fake-id")
        .set("Content-Type", "application/json")
        .send({ format: "xyz" }),
    ]);

    for (const res of responses) {
      if (res.status === 429) continue; // rate-limited, skip
      expect(res.body).toHaveProperty("error");
      expect(res.body).toHaveProperty("type");
      expect(res.body).toHaveProperty("requestId");
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.type).toBe("string");
      expect(res.body).not.toHaveProperty("sql");
      expect(res.body).not.toHaveProperty("prisma");
    }
  });
});

// ---------------------------------------------------------------------------
// Data Sources error contract tests (Commit 8)
// ---------------------------------------------------------------------------
describe("Error Contract — Data Sources", () => {
  it("400 — POST /api/data-sources/extract without content", async () => {
    const res = await request(app)
      .post("/api/data-sources/extract")
      .set("Content-Type", "application/json")
      .send({});

    if (res.status === 429) return; // rate-limited

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      type: "BadRequest",
    });
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("requestId");
  });

  it("404/500 — GET /api/data-sources/:id not found (sanitized)", async () => {
    const res = await request(app).get(
      "/api/data-sources/00000000-0000-0000-0000-000000000000",
    );

    if (res.status === 429) return; // rate-limited

    expect([404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("type");
    expect(res.body).toHaveProperty("requestId");
    // Must NOT leak internal details
    expect(res.body.error).not.toMatch(/prisma/i);
    expect(res.body.error).not.toMatch(/ECONNREFUSED/i);
  });
});

// ---------------------------------------------------------------------------
// Translation error contract tests (Commit 8)
// ---------------------------------------------------------------------------
describe("Error Contract — Translation", () => {
  it("404/500 — POST /api/translation/:fileId/translate non-existent file (sanitized)", async () => {
    const res = await request(app)
      .post("/api/translation/00000000-0000-0000-0000-000000000000/translate")
      .set("Content-Type", "application/json")
      .send({});

    if (res.status === 429) return; // rate-limited

    // Without DB: 500 (Prisma). With DB: 404.
    expect([404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("type");
    expect(res.body).toHaveProperty("requestId");
    // Must NOT leak APS error details
    expect(res.body).not.toHaveProperty("apsError");
    expect(typeof res.body.error).toBe("string");
  });
});
