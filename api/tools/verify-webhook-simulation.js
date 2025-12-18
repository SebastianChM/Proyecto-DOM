const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const prisma = new PrismaClient();

// Function to get active ngrok URL
async function getNgrokUrl() {
  try {
    const response = await axios.get("http://127.0.0.1:4040/api/tunnels");
    const url = response.data.tunnels?.[0]?.public_url;
    if (url) return url;
    throw new Error("No tunnel found");
  } catch (e) {
    console.log("ℹ️  Could not find ngrok (using localhost):", e.message);
    return "http://localhost:8080";
  }
}

async function main() {
  // Determine Target URL
  const baseUrl = await getNgrokUrl();
  const API_URL = `${baseUrl}/api/webhooks/aps/data/callback`;

  console.log("🧪 Starting Webhook Verification Simulation...");
  console.log(`🌍 Target URL: ${API_URL}`);
  console.log(
    "   (If this is an https ngrok URL, we are testing the full internet loop!)",
  );

  // 1. Setup: Ensure User and Project exist
  console.log("1️⃣  Setting up test data...");

  // Find or create a user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test-webhook@example.com",
        name: "Webhook Tester",
        role: "ADMIN",
      },
    });
  }

  // Create a target project
  const project = await prisma.project.create({
    data: {
      name: `Webhook Test Project ${Date.now()}`,
      ownerId: user.id,
      status: "Active",
      isFromAutodesk: true,
      apsOwnerId: "b.mock-aps-project-id",
    },
  });
  console.log(
    `   ✅ Created Test Project: ${project.name} (ID: ${project.id})`,
  );

  // 2. Simulate Webhook Event
  console.log("\n2️⃣  Sending Mock Webhook Event...");

  const mockVersionId = 1;
  const mockUrn = `urn:adsk.wipprod:dm.lineage:mock-file-${Date.now()}`;

  const payload = {
    hook: {
      event: "dm.version.added",
      scope: {
        folder: "mock-folder-id",
        workflowAttribute: {
          projectId: project.id,
          userId: user.id,
          apsProjectId: "b.mock-aps-project-id",
        },
      },
    },
    payload: {
      project: "b.mock-aps-project-id",
      resourceUrn: mockUrn,
      version: "urn:adsk.wipprod:fs.file:vf.mock-file-version-1",
    },
  };

  try {
    const response = await axios.post(API_URL, payload);
    console.log(`   ✅ Webhook sent. Status: ${response.status}`);
  } catch (e) {
    console.error("   ❌ Failed to send webhook:", e.message);
    process.exit(1);
  }

  // 3. Verify Result
  console.log("\n3️⃣  Verifying Database State (Waiting 2s)...");
  await new Promise((r) => setTimeout(r, 2000));

  const file = await prisma.file.findFirst({
    where: {
      projectId: project.id,
      apsUrn: mockUrn,
    },
  });

  if (file) {
    console.log("   🎉 SUCCESS! File record was created automatically.");
    console.log(`      File Name: ${file.name}`);
    console.log(`      Status: ${file.status}`);
    console.log(`      APS URN: ${file.apsUrn}`);
  } else {
    console.error("   ❌ FAILURE: File record was NOT created.");
  }

  // 4. Cleanup
  console.log("\n4️⃣  Cleaning up...");
  await prisma.project.delete({ where: { id: project.id } });
  // Cascading delete should handle the file, but if not:
  // await prisma.file.deleteMany({ where: { projectId: project.id } });
  console.log("   ✅ Test data deleted.");

  if (file) process.exit(0);
  else process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
