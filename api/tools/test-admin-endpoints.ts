import axios from "axios";

const API_URL = "http://localhost:8080";

async function testAdminEndpoints() {
  console.log("\n🔍 TESTING ADMIN PANEL ENDPOINTS\n");
  console.log(
    "NOTE: These tests require authentication. Run after logging in.\n",
  );

  const endpoints = [
    { method: "GET", url: "/api/users", description: "List all users" },
    { method: "GET", url: "/api/projects", description: "List all projects" },
    {
      method: "GET",
      url: "/api/projects/test-id/members",
      description: "Get project members (will 404, testing route)",
    },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint.method} ${endpoint.url}`);
      console.log(`Description: ${endpoint.description}`);

      const response = await axios({
        method: endpoint.method.toLowerCase(),
        url: `${API_URL}${endpoint.url}`,
        withCredentials: true,
        validateStatus: () => true, // Don't throw on any status
      });

      if (response.status === 200) {
        console.log(`✅ SUCCESS - Status: ${response.status}`);
        if (Array.isArray(response.data)) {
          console.log(`   Response: Array with ${response.data.length} items`);
        }
      } else if (response.status === 401) {
        console.log(`🔒 REQUIRES AUTH - Status: ${response.status}`);
        console.log(`   Message: ${response.data?.error || "Unauthorized"}`);
      } else if (response.status === 403) {
        console.log(`🚫 FORBIDDEN - Status: ${response.status}`);
        console.log(`   Message: ${response.data?.error || "Forbidden"}`);
      } else if (response.status === 404) {
        console.log(
          `⚠️  NOT FOUND - Status: ${response.status} (expected for test ID)`,
        );
      } else {
        console.log(`❌ ERROR - Status: ${response.status}`);
        console.log(`   Message: ${response.data?.error || "Unknown error"}`);
      }
    } catch (error: any) {
      console.log(`❌ NETWORK ERROR: ${error.message}`);
    }
    console.log("---\n");
  }

  console.log("\n📋 REQUIRED FIXES:\n");
  console.log("1. All endpoints must use withCredentials: true");
  console.log("2. Backend must have requireAdmin middleware");
  console.log("3. Session must be valid and user must be ADMIN");
  console.log("4. CORS must allow credentials\n");
}

testAdminEndpoints().catch(console.error);
