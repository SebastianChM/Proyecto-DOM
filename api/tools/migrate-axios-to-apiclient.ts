/**
 * 🔧 Script de Migración Axios → ApiClient
 *
 * Reemplaza todas las llamadas axios.* por apiClient.*
 * y actualiza las URLs para usar rutas relativas
 */

import * as fs from "fs";
import * as path from "path";

const dashboardDir = path.join(__dirname, "../../frontend/app/dashboard");

function getAllTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllTsxFiles(fullPath));
    } else if (item.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function migrateFile(filePath: string): {
  changed: boolean;
  changes: string[];
} {
  let content = fs.readFileSync(filePath, "utf-8");
  const changes: string[] = [];
  let changed = false;

  // 1. Reemplazar import de axios por apiClient
  if (
    content.includes('import axios from "axios"') &&
    !content.includes('import apiClient from "@/lib/axios-config"')
  ) {
    content = content.replace(
      'import axios from "axios"',
      'import apiClient from "@/lib/axios-config"',
    );
    changes.push("✅ Import actualizado");
    changed = true;
  }

  // 2. Reemplazar axios.get con URL completa
  const axiosGetMatches = content.match(
    /axios\.get\(`\$\{API_URL\}\/api\/([^`]+)`\)/g,
  );
  if (axiosGetMatches) {
    axiosGetMatches.forEach((match) => {
      const apiPath = match.match(/\/api\/([^`]+)/)?.[0];
      if (apiPath) {
        const newCall = `apiClient.get('${apiPath}')`;
        content = content.replace(match, newCall);
        changes.push(`✅ GET ${apiPath}`);
        changed = true;
      }
    });
  }

  // 3. Reemplazar axios.post
  const axiosPostMatches = content.match(
    /axios\.post\(`\$\{API_URL\}\/api\/([^`]+)`[^)]*\)/g,
  );
  if (axiosPostMatches) {
    axiosPostMatches.forEach((match) => {
      const apiPath = match.match(/\/api\/[^`]+/)?.[0];
      if (apiPath) {
        // Extraer el segundo parámetro (body)
        const bodyMatch = match.match(/axios\.post\(`[^`]+`,\s*([^)]+)\)/);
        const body = bodyMatch ? bodyMatch[1] : "";
        const newCall = body
          ? `apiClient.post('${apiPath}', ${body})`
          : `apiClient.post('${apiPath}')`;
        content = content.replace(match, newCall);
        changes.push(`✅ POST ${apiPath}`);
        changed = true;
      }
    });
  }

  // 4. Reemplazar axios.put
  const axiosPutMatches = content.match(
    /axios\.put\(`\$\{API_URL\}\/api\/([^`]+)`[^)]*\)/g,
  );
  if (axiosPutMatches) {
    axiosPutMatches.forEach((match) => {
      const apiPath = match.match(/\/api\/[^`]+/)?.[0];
      if (apiPath) {
        const bodyMatch = match.match(/axios\.put\(`[^`]+`,\s*([^)]+)\)/);
        const body = bodyMatch ? bodyMatch[1] : "";
        const newCall = body
          ? `apiClient.put('${apiPath}', ${body})`
          : `apiClient.put('${apiPath}')`;
        content = content.replace(match, newCall);
        changes.push(`✅ PUT ${apiPath}`);
        changed = true;
      }
    });
  }

  // 5. Reemplazar axios.delete
  const axiosDeleteMatches = content.match(
    /axios\.delete\(`\$\{API_URL\}\/api\/([^`]+)`\)/g,
  );
  if (axiosDeleteMatches) {
    axiosDeleteMatches.forEach((match) => {
      const apiPath = match.match(/\/api\/[^`]+/)?.[0];
      if (apiPath) {
        const newCall = `apiClient.delete('${apiPath}')`;
        content = content.replace(match, newCall);
        changes.push(`✅ DELETE ${apiPath}`);
        changed = true;
      }
    });
  }

  if (changed) {
    fs.writeFileSync(filePath, content, "utf-8");
  }

  return { changed, changes };
}

// Ejecutar migración
const files = getAllTsxFiles(dashboardDir);
console.log(`\n🔍 Encontrados ${files.length} archivos .tsx en dashboard\n`);

let totalChanged = 0;
let totalChanges = 0;

files.forEach((file) => {
  const relativePath = path.relative(path.join(__dirname, "../.."), file);
  const result = migrateFile(file);

  if (result.changed) {
    console.log(`\n📝 ${relativePath}`);
    result.changes.forEach((change) => console.log(`   ${change}`));
    totalChanged++;
    totalChanges += result.changes.length;
  }
});

console.log(`\n${"=".repeat(60)}`);
console.log(`✅ Migración completada:`);
console.log(`   - ${totalChanged} archivos actualizados`);
console.log(`   - ${totalChanges} cambios aplicados`);
console.log(`${"=".repeat(60)}\n`);
