import prisma from "../../../src/lib/prisma";
import { Queues } from "../../../src/lib/queue";
import { apsOssService } from "../../../src/services/aps/oss.service";
import {
  DesignAutomationCallbackError,
  DesignAutomationCallbackProcessingError,
  enqueueDesignAutomationCallback,
  processDesignAutomationCallbackJob,
  resolveDesignAutomationCallbackUrl,
} from "../../../src/services/design-automation-callback.service";

describe("design-automation-callback.service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("marks conversion as COMPLETED for success callbacks", async () => {
    jest.spyOn(prisma.conversion, "findUnique").mockResolvedValue({
      id: "conv-1",
      workItemId: "wi-1",
      resultUrl: null,
      resultUrn: null,
      status: "PROCESSING",
    } as never);

    const updateSpy = jest
      .spyOn(prisma.conversion, "update")
      .mockResolvedValue({} as never);

    const result = await processDesignAutomationCallbackJob({
      conversionId: "conv-1",
      workItemId: "wi-1",
      status: "success",
      reportUrl: "http://example.com/report",
    });

    expect(result).toEqual({ success: true, status: "COMPLETED" });
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          finishedAt: expect.any(Date),
          completedAt: expect.any(Date),
          resultUrl: "http://example.com/report",
          lastError: null,
          error: null,
        }),
      }),
    );
  });

  it("marks conversion as FAILED for failed callbacks", async () => {
    jest.spyOn(prisma.conversion, "findUnique").mockResolvedValue({
      id: "conv-2",
      workItemId: "wi-2",
      resultUrl: null,
      resultUrn: null,
      status: "PROCESSING",
    } as never);

    const updateSpy = jest
      .spyOn(prisma.conversion, "update")
      .mockResolvedValue({} as never);

    const result = await processDesignAutomationCallbackJob({
      conversionId: "conv-2",
      workItemId: "wi-2",
      status: "failed",
    });

    expect(result).toEqual({ success: false, status: "FAILED" });
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-2" },
        data: expect.objectContaining({
          status: "FAILED",
          lastError: "DA work item failed",
          error: "DA work item failed",
          finishedAt: expect.any(Date),
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("ignores callback when workItemId does not match persisted conversion", async () => {
    jest.spyOn(prisma.conversion, "findUnique").mockResolvedValue({
      id: "conv-3",
      workItemId: "wi-persisted",
      resultUrl: null,
      resultUrn: null,
      status: "PROCESSING",
    } as never);

    const updateSpy = jest.spyOn(prisma.conversion, "update");

    const result = await processDesignAutomationCallbackJob({
      conversionId: "conv-3",
      workItemId: "wi-callback",
      status: "success",
    });

    expect(result).toEqual({ success: false, status: "IGNORED" });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rolls back dedupe key when callback queue enqueue fails", async () => {
    jest
      .spyOn(prisma.conversion, "findFirst")
      .mockResolvedValueOnce({ id: "conv-4" } as never)
      .mockResolvedValueOnce(null as never);

    const updateSpy = jest
      .spyOn(prisma.conversion, "update")
      .mockResolvedValue({ id: "conv-4" } as never);

    const rollbackSpy = jest
      .spyOn(prisma.conversion, "updateMany")
      .mockResolvedValue({ count: 1 } as never);

    jest
      .spyOn(Queues.designAutomationCallback, "add")
      .mockRejectedValue(new Error("redis down"));

    await expect(
      enqueueDesignAutomationCallback(
        { workItemId: "wi-4", status: "success" },
        { requestId: "req-1" },
      ),
    ).rejects.toMatchObject<Partial<DesignAutomationCallbackError>>({
      statusCode: 503,
      code: "QUEUE_UNAVAILABLE",
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-4" },
      }),
    );

    expect(rollbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "conv-4" }),
        data: { dedupeKey: null },
      }),
    );
  });

  it("throws retryable processing error when output artifact is not ready", async () => {
    jest.spyOn(prisma.conversion, "findUnique").mockResolvedValue({
      id: "conv-5",
      workItemId: "wi-5",
      resultUrl: null,
      resultUrn: "oss:test-bucket/conversions/conv-5/output.pdf",
      status: "PROCESSING",
    } as never);

    jest.spyOn(apsOssService, "getObjectDetails").mockRejectedValue({
      response: { status: 404 },
    } as never);

    await expect(
      processDesignAutomationCallbackJob({
        conversionId: "conv-5",
        workItemId: "wi-5",
        status: "success",
      }),
    ).rejects.toMatchObject<Partial<DesignAutomationCallbackProcessingError>>({
      retryable: true,
    });
  });

  it("resolves canonical callback URL from configured origins", () => {
    const callbackUrl = resolveDesignAutomationCallbackUrl();
    expect(callbackUrl).toBeTruthy();
    expect(callbackUrl).toMatch(/\/api\/callbacks\/design-automation\/callback$/);
  });
});
