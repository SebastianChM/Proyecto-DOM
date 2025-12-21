const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "frontend",
  "app",
  "dashboard",
  "viewer",
  "page.tsx",
);

let content = fs.readFileSync(filePath, "utf8");

// Replace the problematic flatMap line
const oldPattern =
  /\{projects\.flatMap\(p => p\.files\)\.filter\(\(f: any\) => f\.status === 'READY' && \(f\.type === 'RVT' \|\| f\.type === 'IFC'\)\)\.slice\(0, 5\)\.map\(\(file: any\) => \(/;

const newCode = `{(Array.isArray(projects) ? projects : [])
                    .reduce((acc: any[], p: any) => {
                        if (p && Array.isArray(p.files)) {
                            return [...acc, ...p.files]
                        }
                        return acc
                    }, [])
                    .filter((f: any) => f && f.status === 'READY' && (f.type === 'RVT' || f.type === 'IFC'))
                    .slice(0, 5)
                    .map((file: any) => (`;

content = content.replace(oldPattern, newCode);

// Also fix the setProjects line
content = content.replace(
  "setProjects(response.data)",
  "setProjects(Array.isArray(response.data) ? response.data : [])",
);

// Add the missing catch setProjects if not present
if (!content.includes("setProjects([])")) {
  content = content.replace(
    'showError(error, user?.role, "Failed to load projects")',
    'showError(error, user?.role, "Failed to load projects")\n                    setProjects([])',
  );
}

fs.writeFileSync(filePath, content, "utf8");
console.log("✅ File patched successfully!");
console.log("✅ flatMap replaced with robust reduce pattern");
console.log("✅ Added Array.isArray checks");
