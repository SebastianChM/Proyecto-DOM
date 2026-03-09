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
      .send({ name: "T", apsProjectId: "b.1", apsFolderId: "f:1", hubId: "h:1" });

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
      request(app).get("/api/project-members/00000000-0000-0000-0000-000000000000/permissions"),
      request(app).post("/api/projects").set("Content-Type", "application/json").send({ name: "T" }),
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
