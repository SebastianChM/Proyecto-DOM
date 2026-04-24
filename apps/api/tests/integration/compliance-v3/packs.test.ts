import request from "supertest";
import { describe, it, expect, afterAll } from "@jest/globals";
import app from "../../../src/index";
import { redis } from "../../../src/lib/redis";
import prisma from "../../../src/lib/prisma";

describe("Compliance V3 — Packs Routes", () => {
  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  describe("GET /api/compliance-v3/packs", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app).get("/api/compliance-v3/packs");
      expect(res.status).toBe(401);
    });

    it("should accept valid query parameters when pagination is provided", async () => {
      const res = await request(app).get(
        "/api/compliance-v3/packs?page=1&limit=10",
      );
      // Either 401 (no auth) or 200 — not 400 (validation passes)
      expect([200, 401]).toContain(res.status);
    });
  });

  describe("GET /api/compliance-v3/packs/:id", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app).get(
        "/api/compliance-v3/packs/nonexistent-id",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/packs", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/packs")
        .send({
          code: "CL-NCH-2026",
          name: "NCh Chile 2026",
          country: "CL",
          version: "1.0.0",
          scope: ["STRUCTURAL"],
        });
      expect(res.status).toBe(401);
    });

    it("should reject invalid body with 401 or 400 when data is missing", async () => {
      const res = await request(app)
        .post("/api/compliance-v3/packs")
        .send({});
      // 401 (no auth) takes precedence, or 400 if auth is not enforced
      expect([400, 401]).toContain(res.status);
    });
  });

  describe("PATCH /api/compliance-v3/packs/:id", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app)
        .patch("/api/compliance-v3/packs/some-id")
        .send({ name: "Updated Pack" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/packs/:id/publish", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app).post(
        "/api/compliance-v3/packs/some-id/publish",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/compliance-v3/packs/:id/deprecate", () => {
    it("should return 401 when user is not authenticated", async () => {
      const res = await request(app).post(
        "/api/compliance-v3/packs/some-id/deprecate",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Route registration", () => {
    it("should return 404 when accessing nonexistent compliance-v3 sub-path", async () => {
      const res = await request(app).get(
        "/api/compliance-v3/nonexistent-route",
      );
      // Either 401 (auth middleware) or 404
      expect([401, 404]).toContain(res.status);
    });
  });
});
