import fs from "fs";
import prisma from "../../../src/lib/prisma";
import { Queues } from "../../../src/lib/queue";
import { apsOssService } from "../../../src/services/aps/oss.service";
import { modelDerivativeService } from "../../../src/services/aps/model-derivative.service";
import { FileService } from "../../../src/services/files.service";

const flushImmediate = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
};

describe("FileService predictive conversion queue dispatch", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enqueues predictive DWG->PDF conversion in MD queue", async () => {
    const fileService = new FileService();

    jest.spyOn(prisma.file, "count").mockResolvedValue(0);
    jest.spyOn(prisma.file, "create").mockResolvedValue({
      id: "file-1",
      uploadedBy: "user-1",
    } as never);
    jest.spyOn(prisma.file, "update").mockResolvedValue({} as never);

    jest.spyOn(apsOssService, "uploadObject").mockResolvedValue({
      objectId: "urn:adsk.objects:os.object:bucket/sample.dwg",
    } as never);

    jest
      .spyOn(modelDerivativeService, "translateToSVF2")
      .mockResolvedValue(undefined as never);

    const conversionCreateSpy = jest
      .spyOn(prisma.conversion, "create")
      .mockResolvedValue({ id: "conv-1" } as never);

    const conversionUpdateSpy = jest
      .spyOn(prisma.conversion, "update")
      .mockResolvedValue({} as never);

    const queueAddSpy = jest
      .spyOn(Queues.conversionMd, "add")
      .mockResolvedValue({ id: "job-1" } as never);

    jest.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("dwg-binary"));

    await fileService.handleFileUpload(
      {
        fieldname: "file",
        originalname: "sample.dwg",
        encoding: "7bit",
        mimetype: "application/octet-stream",
        size: 1024,
        destination: "tmp",
        filename: "sample.dwg",
        path: "tmp/sample.dwg",
        buffer: Buffer.alloc(0),
        stream: fs.createReadStream(__filename),
      } as Express.Multer.File,
      "project-1",
    );

    await flushImmediate();

    expect(conversionCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileId: "file-1",
          targetFormat: "pdf",
          method: "modelDerivative",
          status: "PENDING",
        }),
      }),
    );

    expect(queueAddSpy).toHaveBeenCalledWith(
      "convert",
      expect.objectContaining({
        conversionId: "conv-1",
        userId: "user-1",
        method: "modelDerivative",
        targetFormat: "pdf",
      }),
    );

    expect(conversionUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-1" },
        data: expect.objectContaining({
          status: "QUEUED",
          queuedAt: expect.any(Date),
        }),
      }),
    );
  });
});
