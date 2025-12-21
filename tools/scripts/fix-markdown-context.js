const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../docs/context/PROJECT_CONTEXT.md");

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf8");

// 1. Fix MD010: No hard tabs
content = content.replace(/\t/g, "  ");

// 2. Fix MD037: Spaces inside emphasis markers
// Fix ** bold ** -> **bold**
content = content.replace(/\*\* \s*(.*?)\s* \*\*/g, "**$1**");
// Fix * italic * -> *italic*
content = content.replace(/\* \s*(.*?)\s* \*/g, "*$1*");

// 3. Fix MD041: First line must be H1
// Check if first non-empty line is H1.
// We'll just prepend a title if it's not there, removing any existing non-h1 text at start if needed or just wrapping.
// Actually, repomix output starts with text. Let's make it a H1 or add one.
const lines = content.split("\n");
if (!lines[0].startsWith("# ")) {
  lines.unshift("# Project Context");
  lines.unshift("");
}

// Process lines for spacing and fences
const newLines = [];
let insideFence = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  const prevLine = newLines[newLines.length - 1];

  // Fix MD040: Fenced code blocks should have a language specified
  if (line.trim().startsWith("```")) {
    if (!insideFence) {
      // Start of fence
      // Check if language is missing
      if (line.trim() === "```") {
        // Try to infer from previous file header
        let lang = "text";
        // Look back for "## File: ..."
        for (let j = newLines.length - 1; j >= 0; j--) {
          const l = newLines[j];
          if (l.startsWith("## File:")) {
            const ext = path.extname(l.trim());
            if (ext === ".js") lang = "javascript";
            else if (ext === ".ts") lang = "typescript";
            else if (ext === ".json") lang = "json";
            else if (ext === ".md") lang = "markdown";
            else if (ext === ".yml" || ext === ".yaml") lang = "yaml";
            else if (ext === ".html") lang = "html";
            else if (ext === ".css") lang = "css";
            else if (ext === ".xml") lang = "xml";
            else if (ext === ".cs") lang = "csharp";
            else if (ext === ".java") lang = "java";
            else if (ext === ".py") lang = "python";
            else if (ext === ".sh") lang = "bash";
            else if (ext === ".sql") lang = "sql";
            else if (ext === ".prisma") lang = "prisma";
            // Add more mappings as needed
            break;
          }
          if (l.trim() === "") continue;
          if (j < newLines.length - 5) break; // Don't look back too far
        }
        line = "```" + lang;
      }

      // Fix MD031: Blanks around fences (start)
      if (prevLine && prevLine.trim() !== "") {
        newLines.push("");
      }
      insideFence = true;
    } else {
      // End of fence
      insideFence = false;
      // Fix MD031: Blanks around fences (end)
      // We will handle the blank line AFTER this line in the next iteration logic or by appending only if next is not empty
    }
  }

  // Fix MD022: Blanks around headings
  if (line.trim().startsWith("#") && !insideFence) {
    if (prevLine && prevLine.trim() !== "") {
      newLines.push("");
    }
  }

  // MD032: Lists surrounding blank lines
  // Simple heuristic: if line starts with - or * or 1. and previous is text, add newline
  if (
    !insideFence &&
    (line.trim().startsWith("- ") ||
      line.trim().startsWith("* ") ||
      /^\d+\./.test(line.trim()))
  ) {
    if (
      prevLine &&
      prevLine.trim() !== "" &&
      !prevLine.trim().startsWith("#") &&
      !prevLine.trim().startsWith("-") &&
      !prevLine.trim().startsWith("*") &&
      !/^\d+\./.test(prevLine.trim())
    ) {
      newLines.push("");
    }
  }

  newLines.push(line);

  // Post-processing for spacing after
  // Ensure blank line after heading
  if (line.trim().startsWith("#") && !insideFence) {
    // We can't see the next line yet easily iterating forward,
    // but we can check in the next iteration or peek ahead.
    // Safer to peak ahead.
    if (i < lines.length - 1 && lines[i + 1].trim() !== "") {
      // lines.splice(i+1, 0, ''); // modifying array while iterating is tricky
      // Instead push an empty line now
      newLines.push("");
    }
  }

  // Ensure blank line after fence end
  if (line.trim().startsWith("```") && !insideFence) {
    // Just closed
    if (i < lines.length - 1 && lines[i + 1].trim() !== "") {
      newLines.push("");
    }
  }

  // Ensure blank line after list item if next is not list
  // Complex to detect validation-runner list end perfectly without lookahead, but broadly:
  if (
    !insideFence &&
    (line.trim().startsWith("- ") ||
      line.trim().startsWith("* ") ||
      /^\d+\./.test(line.trim()))
  ) {
    if (i < lines.length - 1) {
      const next = lines[i + 1];
      if (
        next.trim() !== "" &&
        !next.trim().startsWith("- ") &&
        !next.trim().startsWith("* ") &&
        !/^\d+\./.test(next.trim())
      ) {
        newLines.push("");
      }
    }
  }
}

// Final cleanup of multiple blank lines
const finalContent = newLines.join("\n").replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(filePath, finalContent, "utf8");
console.log("Fixed markdown issues in PROJECT_CONTEXT.md");
