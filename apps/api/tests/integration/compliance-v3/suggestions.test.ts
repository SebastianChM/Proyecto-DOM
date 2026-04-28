import request from "supertest";
import { describe, it, expect, afterAll } from "@jest/globals";
import app from "../../../src/index";
import { redis } from "../../../src/lib/redis";
import prisma from "../../../src/lib/prisma";

describe("Compliance V3 — Suggestions Routes", () => {
  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  const PACK_ID = "00000000-0000-0000-0000-000000000099";
  const ANALYSIS_ID = "test-analysis-id-not-in-redis";

  describe("POST /api/compliance-v3/packs/:packId/suggestions/analyze", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/compliance-v3/packs/${PACK_ID}/suggestions/analyze`)
        .send({ text: "Some regulatory text to analyze for requirements" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/suggestions/:analysisId/approve", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/compliance-v3/suggestions/${ANALYSIS_ID}/approve`)
        .send({ index: 0 });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/suggestions/:analysisId/reject", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/compliance-v3/suggestions/${ANALYSIS_ID}/reject`)
        .send();
      expect(res.status).toBe(401);
    });
  });
});
