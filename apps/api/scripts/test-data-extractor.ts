/**
 * Test script for Data Extractor API
 * Run with: npx ts-node api/test-data-extractor.ts
 */

import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import axios from "axios";

const API_BASE = "http://localhost:8080/api/data-sources";

async function testPDFExtraction() {
  console.log("=== Testing PDF Extraction ===\n");

  const pdfPath = path.join(__dirname, "mock-data", "TechnicalSpec.pdf");

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    return null;
  }

  console.log(`📄 Testing with: ${pdfPath}`);

  const form = new FormData();
  form.append("file", fs.createReadStream(pdfPath));
  form.append("projectId", "test-project-001");

  try {
    const response = await axios.post(`${API_BASE}/extract`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    console.log("✅ POST /extract returned:", response.status);
    console.log("Response:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ POST /extract failed:", err.message);
    if (typeof error === "object" && error !== null && "response" in error) {
      const axiosError = error as { response: { data: unknown } };
      console.error("Response:", axiosError.response.data);
    }
    return null;
  }
}

async function testListDataSources(projectId: string) {
  console.log("\n=== Testing List Data Sources ===\n");

  try {
    const response = await axios.get(`${API_BASE}?projectId=${projectId}`);
    console.log("✅ GET /data-sources returned:", response.status);
    console.log("Count:", response.data.length);
    console.log("Data:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ GET /data-sources failed:", err.message);
    return [];
  }
}

async function testGetDataSource(id: string) {
  console.log("\n=== Testing Get Data Source ===\n");

  try {
    const response = await axios.get(`${API_BASE}/${id}`);
    console.log("✅ GET /data-sources/:id returned:", response.status);
    console.log("Data:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ GET /data-sources/:id failed:", err.message);
    return null;
  }
}

async function main() {
  console.log("🧪 Data Extractor API Test Suite\n");
  console.log("================================\n");

  // Test 1: Extract from PDF
  const extractResult = await testPDFExtraction();

  if (extractResult?.id) {
    // Test 2: Get the created data source
    await testGetDataSource(extractResult.id);
  }

  // Test 3: List data sources
  await testListDataSources("test-project-001");

  console.log("\n================================");
  console.log("🏁 Tests completed!");
}

main().catch(console.error);
