import { env } from "../../../src/config/env";
import { designAutomationService } from "../../../src/services/aps/design-automation.service";
import {
  DesignAutomationSubmissionError,
  submitDesignAutomationWorkItem,
} from "../../../src/services/design-automation-submission.service";

describe("design-automation-submission.service", () => {
  const originalBackoff = env.CONVERSION_BACKOFF_DELAY;

  beforeAll(() => {
    env.CONVERSION_BACKOFF_DELAY = 1;
  });

  afterAll(() => {
    env.CONVERSION_BACKOFF_DELAY = originalBackoff;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retries transient submit errors and returns workItemId", async () => {
    const submitSpy = jest
      .spyOn(designAutomationService, "convertRevitToPdf")
      .mockRejectedValueOnce({ response: { status: 503 }, message: "503 unavailable" } as never)
      .mockResolvedValueOnce("wi-retry-ok" as never);

    const result = await submitDesignAutomationWorkItem({
      conversionId: "conv-1",
      inputObjectKey: "input.rvt",
      outputObjectKey: "conversions/conv-1/output.pdf",
      bucketKey: "bucket-1",
      callbackUrl: "https://example.com/api/callbacks/design-automation/callback",
    });

    expect(result).toEqual({ workItemId: "wi-retry-ok", attemptsUsed: 2 });
    expect(submitSpy).toHaveBeenCalledTimes(2);
  });

  it("fails fast on non-retryable submit errors", async () => {
    const submitSpy = jest
      .spyOn(designAutomationService, "convertRevitToPdf")
      .mockRejectedValue({ response: { status: 401 }, message: "401 unauthorized" } as never);

    await expect(
      submitDesignAutomationWorkItem({
        conversionId: "conv-2",
        inputObjectKey: "input-2.rvt",
        outputObjectKey: "conversions/conv-2/output.pdf",
        bucketKey: "bucket-1",
        callbackUrl: "https://example.com/api/callbacks/design-automation/callback",
      }),
    ).rejects.toMatchObject<Partial<DesignAutomationSubmissionError>>({
      retryable: false,
      statusCode: 401,
    });

    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
