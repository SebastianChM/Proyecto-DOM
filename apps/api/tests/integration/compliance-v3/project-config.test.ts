import request from "supertest";
import { describe, it, expect, afterAll } from "@jest/globals";
import app from "../../../src/index";
import { redis } from "../../../src/lib/redis";
import prisma from "../../../src/lib/prisma";

describe("Compliance V3 — Project Config Routes", () => {
  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
  const OVERRIDE_ID = "00000000-0000-0000-0000-000000000002";

  describe("GET /api/compliance-v3/projects/:projectId/compliance-config", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get(
        `/api/compliance-v3/projects/${PROJECT_ID}/compliance-config`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/compliance-v3/projects/:projectId/compliance-config", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .put(`/api/compliance-v3/projects/${PROJECT_ID}/compliance-config`)
        .send({ packIds: ["00000000-0000-0000-0000-000000000003"] });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/projects/:projectId/compliance-config/overrides", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(
          `/api/compliance-v3/projects/${PROJECT_ID}/compliance-config/overrides`,
        )
        .send({
          requirementId: "00000000-0000-0000-0000-000000000004",
          action: "SKIP",
          reason: "Not applicable",
          approvedBy: "user-001",
        });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/compliance-v3/projects/:projectId/compliance-config/overrides/:overrideId", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app).delete(
        `/api/compliance-v3/projects/${PROJECT_ID}/compliance-config/overrides/${OVERRIDE_ID}`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/compliance-v3/projects/:projectId/compliance-config/resolved", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get(
        `/api/compliance-v3/projects/${PROJECT_ID}/compliance-config/resolved`,
      );
      expect(res.status).toBe(401);
    });
  });
});
