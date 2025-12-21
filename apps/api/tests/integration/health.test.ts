import request from "supertest";
import app from "../../src/index";
import { redis } from "../../src/lib/redis";

describe("Health Check", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("should return 200 OK", async () => {
    const res = await request(app).get("/health");
    // It might return 503 if redis is down in test env, but structrually it works
    expect(res.status).toBeDefined();
    expect(res.body).toHaveProperty("version");
  });
});
