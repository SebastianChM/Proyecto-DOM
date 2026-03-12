import prisma from "../../../src/lib/prisma";
import {
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
      resultUrl: null,
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
        }),
      }),
    );
  });

  it("marks conversion as FAILED for failed callbacks", async () => {
    jest.spyOn(prisma.conversion, "findUnique").mockResolvedValue({
      id: "conv-2",
      resultUrl: null,
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
          finishedAt: expect.any(Date),
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("resolves canonical callback URL from configured origins", () => {
    const callbackUrl = resolveDesignAutomationCallbackUrl();
    expect(callbackUrl).toBeTruthy();
    expect(callbackUrl).toMatch(/\/api\/callbacks\/design-automation\/callback$/);
  });
});
