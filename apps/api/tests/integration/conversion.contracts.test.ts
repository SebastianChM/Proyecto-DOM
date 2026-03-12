import request from "supertest";
import app from "../../src/index";
import { redis } from "../../src/lib/redis";
import prisma from "../../src/lib/prisma";
import { conversionService } from "../../src/services/conversion.service";

describe("Conversion API contracts", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  it("GET /api/conversion/formats returns supported format map", async () => {
    const formats = {
      dwg: ["pdf"],
      rvt: ["ifc", "pdf"],
    };

    jest
      .spyOn(conversionService, "getSupportedFormats")
      .mockReturnValue(formats);

    const response = await request(app).get("/api/conversion/formats");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ formats });
  });

  it("POST /api/conversion/:fileId returns normalized single conversion payload", async () => {
    jest.spyOn(conversionService, "createSingle").mockResolvedValue({
      id: "conv-1",
      fileId: "file-1",
      targetFormat: "pdf",
      method: "modelDerivative",
      status: "PENDING",
    } as Awaited<ReturnType<typeof conversionService.createSingle>>);

    const response = await request(app)
      .post("/api/conversion/file-1")
      .send({ format: "pdf" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      message: "Conversion queued",
      conversion: {
        id: "conv-1",
        fileId: "file-1",
        targetFormat: "pdf",
        status: "PENDING",
        method: "modelDerivative",
      },
    });
  });

  it("POST /api/conversion/batch returns normalized batch kickoff payload", async () => {
    jest.spyOn(conversionService, "createBatch").mockResolvedValue({
      batchId: "batch-1",
      enqueued: 2,
      failed: 1,
      errors: [{ fileId: "file-3", error: "Unsupported conversion" }],
    });

    const response = await request(app).post("/api/conversion/batch").send({
      fileIds: ["file-1", "file-2", "file-3"],
      format: "pdf",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      batchId: "batch-1",
      started: 2,
      enqueued: 2,
      failed: 1,
      errors: [{ fileId: "file-3", error: "Unsupported conversion" }],
    });
  });

  it("GET /api/conversion/batch/:batchId returns normalized status payload", async () => {
    jest.spyOn(conversionService, "getBatchStatus").mockResolvedValue({
      batchId: "batch-1",
      status: "processing",
      summary: {
        pending: 1,
        processing: 1,
        completed: 1,
        failed: 0,
        queued: 0,
      },
      progress: 33,
      errors: [],
      total: 3,
      counts: {
        pending: 1,
        queued: 0,
        processing: 1,
        completed: 1,
        failed: 0,
      },
      failures: [],
    });

    const response = await request(app).get("/api/conversion/batch/batch-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        batchId: "batch-1",
        status: "processing",
        summary: expect.objectContaining({
          pending: 1,
          processing: 1,
          completed: 1,
          failed: 0,
        }),
      }),
    );
  });
});
