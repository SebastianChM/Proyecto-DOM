// MOP Parser Service - Handles extraction from Manual de Carreteras Vol 5
import { MopSection } from "../types/mop-definitions";

export class MopParserService {
  /**
   * Parses the full text of the MOP Manual and returns a structured tree.
   * MOP Structure: 5.xxx.y (e.g. 5.401.2 MATERIALES)
   */
  parse(text: string): MopSection[] {
    const lines = text.split("\n");
    const sections: MopSection[] = [];
    let currentSection: MopSection | null = null;

    // Regex to capture: "5.401.1", "5.401 .2" (typo handling), "5.410.309"
    const headerRegex = /^(5\.\d{3}\s?\.?\s?\d+)\s+(.+)$/;

    // Heuristic 1: Key-Value (e.g. "Slump: 5 cm", "Espesor = 20mm")
    const keyValueRegex =
      /([A-Za-z\s().]+)\s*(?:=|:|debe ser|será|mínimo|máximo)\s*([0-9.,]+\s*[A-Za-z%/³²]+)/i;

    // Heuristic 2: Concrete Grade (e.g. "Grado H-30", "Hormigón H35")
    const gradeRegex = /(Hormigón|Grado)\s*(H-?\d+)/i;

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      // 1. Detect Section Header
      const headerMatch = cleanLine.match(headerRegex);
      if (headerMatch) {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          code: headerMatch[1].replace(/\s+/g, ""), // Normalize "5.401 .2" -> "5.401.2"
          title: headerMatch[2].trim(),
          content: [],
          requirements: [],
        };
        continue;
      }

      // 2. Add content to current section
      if (currentSection) {
        currentSection.content.push(cleanLine);

        // 3. Extract Requirements logic
        if (cleanLine.length > 10 && !cleanLine.match(/^\d+$/)) {
          // Check Generic Key-Value
          const kvMatch = cleanLine.match(keyValueRegex);
          if (kvMatch) {
            currentSection.requirements.push({
              originalText: cleanLine,
              parameter: kvMatch[1].trim(),
              value: kvMatch[2].trim(),
              sectionCode: currentSection.code,
            });
            continue;
          }

          // Check Concrete Grade
          const gradeMatch = cleanLine.match(gradeRegex);
          if (gradeMatch) {
            currentSection.requirements.push({
              originalText: cleanLine,
              parameter: "Grado Hormigón",
              value: gradeMatch[2].trim(), // e.g. "H-30"
              sectionCode: currentSection.code,
            });
          }
        }
      }
    }

    // Push the last section
    if (currentSection) sections.push(currentSection);

    return sections;
  }

  /**
   * Filters sections by Discipline based on MOP 5 coding.
   * 5.1xx - 5.3xx: Earthworks (Movement)
   * 5.4xx: Concrete / Pavements (Structural)
   * 5.5xx: Asphalt
   * 5.6xx: Bridges / Structures
   * 5.7xx+: Tunneling / Safety / Others
   */
  filterByDiscipline(
    sections: MopSection[],
    discipline: "STRUCTURAL" | "MEP" | "ALL",
  ): MopSection[] {
    if (discipline === "ALL") return sections;

    return sections.filter((s) => {
      if (discipline === "STRUCTURAL") {
        return s.code.startsWith("5.4") || s.code.startsWith("5.6");
      }
      // MOP Vol 5 is mostly civil/structural. MEP is less common but might appear in lighting/tunnels.
      return false;
    });
  }
}
