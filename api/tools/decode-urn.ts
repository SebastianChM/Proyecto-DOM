import prisma from "../src/lib/prisma";

async function main() {
  const file = await prisma.file.findUnique({
    where: { id: "80f02bf1-3bc5-467b-90e1-b3b9ad7d9072" },
  });

  if (!file) {
    console.log("File not found");
    return;
  }

  console.log("File name:", file.name);
  console.log("s3Key:", file.s3Key);
  console.log("apsUrn (encoded):", file.apsUrn);

  if (file.apsUrn) {
    // Decode the URN
    const padded = file.apsUrn.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (padded.length % 4)) % 4;
    const base64 = padded + "=".repeat(padding);
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    console.log("\nDecoded URN:", decoded);

    // Extract object key
    const match = decoded.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);
    if (match) {
      console.log("Object key:", match[1]);
    } else {
      console.log("Could not extract object key from URN");
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
