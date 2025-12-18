import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { apsAuthService } from "../src/services/aps/auth.service";

const TARGET_URN =
  "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWRvbS1iaW0tcGxhdGZvcm0tdXMtdGVzdC0wMDEvMTc2NTMyNTQ1OTkxNy1DTUEtSURPLUlELUVMWC1YLVgtMTktMDAwMC0wMC5ydnQ";

interface Child {
  guid?: string;
  type?: string;
  role?: string;
  mime?: string;
  urn?: string;
  name?: string;
  outputType?: string;
  progress?: string;
  status?: string;
  children?: Child[];
}

function findAllPdfs(children: Child[], path: string = ""): string[] {
  let pdfs: string[] = [];

  for (const child of children) {
    const childPath = `${path}/${child.name || child.role || child.type || "unknown"}`;

    if (
      child.mime?.includes("pdf") ||
      child.role === "pdf" ||
      child.urn?.includes(".pdf")
    ) {
      pdfs.push(`${childPath} => ${child.urn}`);
    }

    // Log 2D views - they might have PDF as children
    if (child.role === "2d") {
      console.log(`\n📄 2D View found at: ${childPath}`);
      console.log(`   Type: ${child.type}, MIME: ${child.mime || "N/A"}`);
      console.log(`   GUID: ${child.guid}`);
      if (child.urn) console.log(`   URN: ${child.urn}`);

      if (child.children) {
        console.log(`   Has ${child.children.length} children:`);
        child.children.forEach((c, i) => {
          console.log(
            `     ${i + 1}. Role: ${c.role}, MIME: ${c.mime}, Type: ${c.type}`,
          );
          if (c.urn) console.log(`        URN: ${c.urn}`);
        });
      }
    }

    if (child.children) {
      pdfs = pdfs.concat(findAllPdfs(child.children, childPath));
    }
  }

  return pdfs;
}

async function main() {
  console.log("🔍 Deep Scan for PDF Resources in Manifest...\n");

  const token = await apsAuthService.getInternalToken();

  try {
    const response = await axios.get(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${TARGET_URN}/manifest`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const manifest = response.data;

    console.log("=== SCANNING DERIVATIVES ===");
    console.log(
      `Total top-level derivatives: ${manifest.derivatives?.length || 0}\n`,
    );

    if (manifest.derivatives) {
      for (const derivative of manifest.derivatives) {
        console.log(
          `\n--- Derivative: ${derivative.outputType} (${derivative.status}) ---`,
        );

        if (derivative.children) {
          const pdfs = findAllPdfs(derivative.children);

          if (pdfs.length > 0) {
            console.log("\n🎯 FOUND PDF RESOURCES:");
            pdfs.forEach((pdf) => console.log(`  - ${pdf}`));
          }
        }
      }
    }

    // Check for 2D views that might be PDFs directly
    console.log("\n\n=== CHECKING FOR EMBEDDED PDFs ===");

    const svf2 = manifest.derivatives?.find(
      (d: any) => d.outputType === "svf2",
    );
    if (svf2?.children) {
      const views2d = svf2.children.filter((c: Child) => c.role === "2d");
      console.log(`\nFound ${views2d.length} 2D views in SVF2 derivative.`);

      // Sample the first 3
      for (let i = 0; i < Math.min(3, views2d.length); i++) {
        const view = views2d[i];
        console.log(`\nSample 2D View ${i + 1}:`);
        console.log(JSON.stringify(view, null, 2));
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

main();
