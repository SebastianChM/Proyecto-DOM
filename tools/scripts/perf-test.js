const axios = require("axios");

const API_URL = "http://localhost:8080/api";
const ITERATIONS = 10;

// Helper to measure time
const measure = async (name, fn) => {
  const start = performance.now();
  try {
    await fn();
    const end = performance.now();
    return end - start;
  } catch (e) {
    console.error(`Error in ${name}:`, e.message);
    return null;
  }
};

const runTest = async () => {
  console.log("🚀 Starting Performance Test...");

  // NOTE: This script assumes you have a valid session cookie string to paste below if auth is required.
  const cookie = ""; // PASTE SESSION COOKIE HERE IF NEEDED

  const headers = cookie ? { Cookie: cookie } : {};

  console.log("\nTesting /api/projects (List)...");
  let totalTime = 0;
  let successCount = 0;
  let projectId = null;

  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measure(`Request ${i + 1}`, async () => {
      const res = await axios.get(`${API_URL}/projects`, { headers });
      if (res.data && res.data.length > 0) {
        projectId = res.data[0].id;
      }
    });

    if (time !== null) {
      console.log(`Request ${i + 1}: ${time.toFixed(2)}ms`);
      totalTime += time;
      successCount++;
    }
  }

  if (successCount > 0) {
    console.log(
      `Average Time (List): ${(totalTime / successCount).toFixed(2)}ms`,
    );
  } else {
    console.log(
      "All requests failed (likely 401 Unauthorized). Please provide a valid session cookie.",
    );
  }

  if (projectId) {
    console.log(`\nTesting /api/projects/${projectId} (Details)...`);
    totalTime = 0;
    successCount = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const time = await measure(`Request ${i + 1}`, async () => {
        await axios.get(`${API_URL}/projects/${projectId}`, { headers });
      });

      if (time !== null) {
        console.log(`Request ${i + 1}: ${time.toFixed(2)}ms`);
        totalTime += time;
        successCount++;
      }
    }
    if (successCount > 0) {
      console.log(
        `Average Time (Details): ${(totalTime / successCount).toFixed(2)}ms`,
      );
    }
  }

  console.log("\nTesting /api/files/recent...");
  totalTime = 0;
  successCount = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measure(`Request ${i + 1}`, async () => {
      await axios.get(`${API_URL}/files/recent`, { headers });
    });

    if (time !== null) {
      console.log(`Request ${i + 1}: ${time.toFixed(2)}ms`);
      totalTime += time;
      successCount++;
    }
  }
  if (successCount > 0) {
    console.log(
      `Average Time (Recent): ${(totalTime / successCount).toFixed(2)}ms`,
    );
  }

  console.log("\nTest Complete.");
};

runTest();
