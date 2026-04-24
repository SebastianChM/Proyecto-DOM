import request from "supertest";
import { describe, it, expect, afterAll } from "@jest/globals";
import app from "../../../src/index";
import { redis } from "../../../src/lib/redis";
import prisma from "../../../src/lib/prisma";

describe("Compliance V3 — Runs Routes", () => {
  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  const PROJECT_ID = "00000000-0000-0000-0000-000000000011";
  const RUN_ID = "00000000-0000-0000-0000-000000000012";

  describe("POST /api/compliance-v3/projects/:projectId/compliance/evaluate", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/compliance-v3/projects/${PROJECT_ID}/compliance/evaluate`)
        .send({ modelUrn: "dXJuOmFkc2sub2JqZWN0czE6dGVzdA==" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/compliance-v3/compliance/runs/:runId", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get(
        `/api/compliance-v3/compliance/runs/${RUN_ID}`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/compliance-v3/projects/:projectId/compliance/runs", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get(
        `/api/compliance-v3/projects/${PROJECT_ID}/compliance/runs`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/compliance-v3/compliance/runs/:runId/issues", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get(
        `/api/compliance-v3/compliance/runs/${RUN_ID}/issues`,
      );
      expect(res.status).toBe(401);
    });
  });
});
