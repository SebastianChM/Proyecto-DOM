import { Router } from "express";
import prisma from "../lib/prisma";
import { modelDerivativeService } from "../services/aps/model-derivative.service";

const router = Router();

/**
 * @swagger
 * /translation/{fileId}/translate:
 *   post:
 *     summary: Retry translation for a file
 *     tags: [Translation]
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: Translation started
 *       400:
 *         description: File not found or not supported
 *       500:
 *         description: Server error
 */
// Retry translation for a file stuck in UPLOADED state
router.post("/:fileId/translate", async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (!file.apsUrn) {
      return res
        .status(400)
        .json({ error: "File has no APS URN. Cannot translate." });
    }

    if (file.status === "READY") {
      return res.json({
        success: true,
        message: "File is already translated",
        status: "READY",
      });
    }

    if (file.status === "TRANSLATING") {
      return res.json({
        success: true,
        message: "Translation already in progress",
        status: "TRANSLATING",
      });
    }

    // Check supported file types
    const supportedExtensions = [
      ".rvt",
      ".dwg",
      ".ifc",
      ".nwc",
      ".obj",
      ".stl",
      ".step",
      ".stp",
      ".3dm",
      ".skp",
      ".max",
      ".f3d",
      ".iam",
      ".ipt",
    ];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    // Check if it's a local mock file (which we allow to "translate" for testing)
    const isLocalMock = file.apsUrn.startsWith("local-");

    if (!supportedExtensions.includes(fileExt) && !isLocalMock) {
      return res.status(400).json({
        error: `File type ${fileExt} is not supported for 3D translation.`,
        details: "Supported formats: " + supportedExtensions.join(", "),
      });
    }

    // Start translation
    console.log(`🔄 Starting translation for file: ${file.name}`);

    if (file.apsUrn.startsWith("local-")) {
      console.log("🔧 Local mode detected. Simulating translation...");
      // Simulate translation
      setTimeout(async () => {
        try {
          await prisma.file.update({
            where: { id: fileId },
            data: { status: "READY" },
          });
          console.log(
            `✅ Mock translation complete for ${file.name} - status: READY`,
          );
        } catch (e) {
          console.error("Failed to update mock translation status:", e);
        }
      }, 5000);
    } else {
      // Ensure URN is URL-safe Base64 (APS requirement)
      // If the URN in DB has +, /, or =, it means it wasn't encoded correctly.
      let safeUrn = file.apsUrn;
      if (
        safeUrn.includes("+") ||
        safeUrn.includes("/") ||
        safeUrn.includes("=")
      ) {
        console.log(
          `⚠️ Detected non-URL-safe URN for file ${file.name}. Fixing...`,
        );
        safeUrn = safeUrn
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        // Update DB with safe URN to prevent future issues
        await prisma.file.update({
          where: { id: fileId },
          data: { apsUrn: safeUrn },
        });
      }

      await modelDerivativeService.translateToSVF2(safeUrn);
    }

    // Update status
    await prisma.file.update({
      where: { id: fileId },
      data: { status: "TRANSLATING" },
    });

    res.json({
      success: true,
      message: "Translation started",
      fileId,
      status: "TRANSLATING",
    });
  } catch (error: unknown) {
    const err = error as {
      response?: { data?: unknown; status?: number };
      message?: string;
    };
    console.error("Translation retry failed:", err);
    console.error("Error details:", err.response?.data || err.message);

    const statusCode = err.response?.status || 500;
    res.status(statusCode).json({
      error: "Failed to start translation",
      details: err.message,
      apsError: err.response?.data,
    });
  }
});

export default router;
