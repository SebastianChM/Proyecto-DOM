import request from "supertest";
import app from "../../src/index";
import { redis } from "../../src/lib/redis";
import prisma from "../../src/lib/prisma";
import { Queues } from "../../src/lib/queue";

describe("Design Automation callback route", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  it("enqueues callback payload and returns 202", async () => {
    jest
      .spyOn(prisma.conversion, "findFirst")
      .mockResolvedValueOnce({ id: "conv-1" } as never)
      .mockResolvedValueOnce(null as never);

    jest
      .spyOn(prisma.conversion, "update")
      .mockResolvedValue({ id: "conv-1" } as never);

    const queueAddSpy = jest
      .spyOn(Queues.designAutomationCallback, "add")
      .mockResolvedValue({ id: "job-1" } as never);

    const response = await request(app)
      .post("/api/callbacks/design-automation/callback")
      .send({ workItemId: "wi-123", status: "success", reportUrl: "http://example.com/report" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      accepted: true,
      conversionId: "conv-1",
    });

    expect(queueAddSpy).toHaveBeenCalledWith(
      "process-da-callback",
      expect.objectContaining({
        conversionId: "conv-1",
        workItemId: "wi-123",
        status: "success",
      }),
    );
  });

  it("returns 200 for duplicate callback and does not enqueue again", async () => {
    jest
      .spyOn(prisma.conversion, "findFirst")
      .mockResolvedValueOnce({ id: "conv-1" } as never)
      .mockResolvedValueOnce({ id: "conv-1" } as never);

    const queueAddSpy = jest
      .spyOn(Queues.designAutomationCallback, "add")
      .mockResolvedValue({ id: "job-1" } as never);

    const response = await request(app)
      .post("/api/callbacks/design-automation/callback")
      .send({ workItemId: "wi-123", status: "success" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Already processed (idempotent)",
      conversionId: "conv-1",
    });
    expect(queueAddSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when callback payload is invalid", async () => {
    const response = await request(app)
      .post("/api/callbacks/design-automation/callback")
      .send({ status: "success" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        code: "INVALID_PAYLOAD",
      }),
    );
  });
});
