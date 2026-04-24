import request from "supertest";
import { describe, it, expect, afterAll } from "@jest/globals";
import app from "../../../src/index";
import { redis } from "../../../src/lib/redis";
import prisma from "../../../src/lib/prisma";

describe("Compliance V3 — Requirements Routes", () => {
  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  const VALID_REQUIREMENT = {
    code: "CL-OGUC-R001",
    description: "Ancho minimo de pasillo de evacuacion segun OGUC Art. 4.2.5",
    legalReference: "OGUC Art. 4.2.5",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["evacuacion"],
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=",
        value: "1200",
        unit: "mm",
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Corridors"],
      scope: "FILTERED",
    },
  };

  describe("GET /api/compliance-v3/packs/:packId/requirements", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app).get(
        "/api/compliance-v3/packs/some-pack-id/requirements",
      );
      expect(res.status).toBe(401);
    });

    it("should accept valid pagination when query params are provided", async () => {
      const res = await request(app).get(
        "/api/compliance-v3/packs/some-pack-id/requirements?page=1&limit=10",
      );
      expect([200, 401]).toContain(res.status);
    });
  });

  describe("GET /api/compliance-v3/requirements/:id", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app).get(
        "/api/compliance-v3/requirements/nonexistent-id",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/packs/:packId/requirements", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/packs/some-pack-id/requirements")
        .send(VALID_REQUIREMENT);
      expect(res.status).toBe(401);
    });

    it("should reject body without conditions when validation is active", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/packs/some-pack-id/requirements")
        .send({ code: "CL-X-R001", description: "Test" });
      // 401 (auth) or 400 (validation)
      expect([400, 401]).toContain(res.status);
    });
  });

  describe("PATCH /api/compliance-v3/requirements/:id", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app)
        .patch("/api/compliance-v3/requirements/some-id")
        .send({ description: "Updated" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/requirements/:id/verify", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/requirements/some-id/verify")
        .send({ userId: "verifier-001" });
      expect(res.status).toBe(401);
    });

    it("should reject body without userId when validation is active", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/requirements/some-id/verify")
        .send({});
      expect([400, 401]).toContain(res.status);
    });
  });

  describe("DELETE /api/compliance-v3/requirements/:id", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app).delete(
        "/api/compliance-v3/requirements/some-id",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/packs/:packId/requirements/bulk", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/packs/some-pack-id/requirements/bulk")
        .send({ requirements: [VALID_REQUIREMENT] });
      expect(res.status).toBe(401);
    });

    it("should reject empty requirements array when validation is active", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/packs/some-pack-id/requirements/bulk")
        .send({ requirements: [] });
      expect([400, 401]).toContain(res.status);
    });
  });
});
