/**
 * Compliance Runner Service v2
 *
 * Executes compliance checks by evaluating BIM elements against database rules.
 * Part of Compliance Engine V2 - Professional Rule-Based Validation
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Types
export interface BimElement {
  id: string;
  name: string;
  category: string;
  properties: Record<string, unknown>;
}

export interface RuleResult {
  passed: boolean;
  ruleName: string;
  ruleId: string;
  elementId: string;
  elementName: string;
  elementCategory: string;
  propertyName: string;
  expectedValue: string;
  actualValue: string | null;
  deviation?: number;
  severity: "CRITICAL" | "WARNING" | "INFO";
  sourceDocument?: string;
  sourcePage?: number;
}

export interface ComplianceRunResult {
  runId: string;
  status: "COMPLETED" | "FAILED";
  rulesetId: string;
  rulesetName: string;
  totalElements: number;
  totalRules: number;
  passedCount: number;
  failedCount: number;
  complianceScore: number;
  issues: RuleResult[];
  summary: {
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  };
  startedAt: Date;
  completedAt: Date;
  duration: number;
}

export class ComplianceRunnerService {
  /**
   * Execute a compliance run using rules from a specific ruleset
   */
  async run(
    elements: BimElement[],
    rulesetId: string,
    projectId: string,
    modelUrn?: string,
    modelName?: string,
  ): Promise<ComplianceRunResult> {
    const startedAt = new Date();
    console.log(`[ComplianceRunner] Starting run with ruleset: ${rulesetId}`);
    console.log(`[ComplianceRunner] Elements: ${elements.length}`);

    // Get ruleset with active rules
    const ruleset = await prisma.ruleset.findUnique({
      where: { id: rulesetId },
      include: {
        rules: {
          where: { isActive: true },
        },
      },
    });

    if (!ruleset) {
      throw new Error(`Ruleset not found: ${rulesetId}`);
    }

    console.log(
      `[ComplianceRunner] Ruleset: ${ruleset.name}, Rules: ${ruleset.rules.length}`,
    );

    // Create compliance run record
    const run = await prisma.complianceRun.create({
      data: {
        status: "RUNNING",
        modelUrn: modelUrn || "unknown",
        modelName: modelName || undefined,
        rulesetId,
        totalElements: elements.length,
        projectId,
        startedAt,
      },
    });

    try {
      // Evaluate rules against elements
      const issues: RuleResult[] = [];

      for (const rule of ruleset.rules) {
        const ruleIssues = this.evaluateRule(
          rule as Parameters<typeof this.evaluateRule>[0],
          elements,
        );
        issues.push(...ruleIssues);
      }

      // Calculate statistics
      const passedCount =
        elements.length * ruleset.rules.length - issues.length;
      const failedCount = issues.length;
      const complianceScore =
        ruleset.rules.length > 0 && elements.length > 0
          ? Math.round((passedCount / (passedCount + failedCount)) * 100)
          : 100;

      // Group by severity
      const bySeverity: Record<string, number> = {};
      const byCategory: Record<string, number> = {};

      for (const issue of issues) {
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
        byCategory[issue.elementCategory] =
          (byCategory[issue.elementCategory] || 0) + 1;
      }

      const completedAt = new Date();

      // Update run record
      await prisma.complianceRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          totalElements: elements.length,
          failedCount,
          complianceScore,
          completedAt,
        },
      });

      // Save issues
      if (issues.length > 0) {
        await prisma.complianceIssue.createMany({
          data: issues.map((issue) => ({
            runId: run.id,
            ruleName: issue.ruleName,
            elementId: issue.elementId,
            elementName: issue.elementName,
            elementCategory: issue.elementCategory,
            propertyName: issue.propertyName,
            expectedValue: issue.expectedValue,
            actualValue: issue.actualValue || "N/A",
            deviation: issue.deviation?.toString() || null,
            severity: issue.severity,
            status: "OPEN",
          })),
        });
      }

      console.log(
        `[ComplianceRunner] Completed. Score: ${complianceScore}%, Issues: ${issues.length}`,
      );

      return {
        runId: run.id,
        status: "COMPLETED",
        rulesetId,
        rulesetName: ruleset.name,
        totalElements: elements.length,
        totalRules: ruleset.rules.length,
        passedCount,
        failedCount,
        complianceScore,
        issues,
        summary: { bySeverity, byCategory },
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
      };
    } catch (error: unknown) {
      // Mark run as failed
      await prisma.complianceRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * Evaluate a single rule against all elements
   */
  private evaluateRule(
    rule: {
      id: string;
      name: string;
      targetCategory: string;
      targetNamePattern?: string | null;
      propertyName: string;
      operator: string;
      expectedValue: string;
      unit?: string | null;
      severity: string; // From Prisma, could be CRITICAL | WARNING | INFO
      sourceDocument?: string | null;
      sourcePage?: number | null;
      tolerance?: number | null;
    },
    elements: BimElement[],
  ): RuleResult[] {
    const issues: RuleResult[] = [];

    // Filter elements by category
    const matchingElements = elements.filter(
      (el) =>
        this.matchesCategory(el.category, rule.targetCategory) &&
        this.matchesNamePattern(el.name, rule.targetNamePattern),
    );

    console.log(
      `[ComplianceRunner] Rule "${rule.name}": ${matchingElements.length}/${elements.length} elements match`,
    );

    for (const element of matchingElements) {
      const result = this.checkCompliance(rule, element);
      if (!result.passed) {
        issues.push({
          passed: false,
          ruleName: rule.name,
          ruleId: rule.id,
          elementId: element.id,
          elementName: element.name,
          elementCategory: element.category,
          propertyName: rule.propertyName,
          expectedValue: `${rule.operator} ${rule.expectedValue}${rule.unit ? " " + rule.unit : ""}`,
          actualValue: result.actualValue,
          deviation: result.deviation,
          severity: rule.severity as "CRITICAL" | "WARNING" | "INFO",
          sourceDocument: rule.sourceDocument ?? undefined,
          sourcePage: rule.sourcePage ?? undefined,
        });
      }
    }

    return issues;
  }

  /**
   * Check if element matches rule category
   */
  private matchesCategory(
    elementCategory: string,
    ruleCategory: string | null,
  ): boolean {
    if (!ruleCategory) return true;
    const normElement = elementCategory.toLowerCase().replace(/\s+/g, "");
    const normRule = ruleCategory.toLowerCase().replace(/\s+/g, "");
    return normElement.includes(normRule) || normRule.includes(normElement);
  }

  /**
   * Check if element name matches pattern
   */
  private matchesNamePattern(
    elementName: string,
    pattern?: string | null,
  ): boolean {
    if (!pattern) return true;
    try {
      const regex = new RegExp(pattern, "i");
      return regex.test(elementName);
    } catch {
      return elementName.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  /**
   * Check if an element complies with a rule
   */
  private checkCompliance(
    rule: {
      propertyName: string;
      expectedValue: string;
      tolerance?: number | null;
      operator: string;
    },
    element: BimElement,
  ): {
    passed: boolean;
    actualValue: string | null;
    deviation?: number;
  } {
    // Find the property value
    const actualValue = this.findPropertyValue(
      element.properties,
      rule.propertyName,
    );

    if (actualValue === null || actualValue === undefined) {
      return { passed: false, actualValue: null };
    }

    const expectedNum = parseFloat(rule.expectedValue);
    const actualNum = parseFloat(String(actualValue));
    const tolerance = rule.tolerance || 0;

    // If both are numbers, do numeric comparison
    if (!isNaN(expectedNum) && !isNaN(actualNum)) {
      let passed = false;
      let deviation = 0;

      switch (rule.operator) {
        case "==":
        case "=":
          passed = Math.abs(actualNum - expectedNum) <= tolerance;
          deviation = actualNum - expectedNum;
          break;
        case ">=":
          passed = actualNum >= expectedNum - tolerance;
          deviation = actualNum - expectedNum;
          break;
        case "<=":
          passed = actualNum <= expectedNum + tolerance;
          deviation = actualNum - expectedNum;
          break;
        case ">":
          passed = actualNum > expectedNum;
          deviation = actualNum - expectedNum;
          break;
        case "<":
          passed = actualNum < expectedNum;
          deviation = actualNum - expectedNum;
          break;
        case "!=":
          passed = actualNum !== expectedNum;
          deviation = actualNum - expectedNum;
          break;
        case "range": {
          const [min, max] = rule.expectedValue.split("-").map(parseFloat);
          passed = actualNum >= min && actualNum <= max;
          deviation =
            actualNum < min
              ? actualNum - min
              : actualNum > max
                ? actualNum - max
                : 0;
          break;
        }
        default:
          passed = actualNum === expectedNum;
          deviation = actualNum - expectedNum;
      }

      return { passed, actualValue: String(actualValue), deviation };
    }

    // String comparison
    const actualStr = String(actualValue).toLowerCase();
    const expectedStr = rule.expectedValue.toLowerCase();

    switch (rule.operator) {
      case "==":
      case "=":
        return {
          passed: actualStr === expectedStr,
          actualValue: String(actualValue),
        };
      case "!=":
        return {
          passed: actualStr !== expectedStr,
          actualValue: String(actualValue),
        };
      case "contains":
        return {
          passed: actualStr.includes(expectedStr),
          actualValue: String(actualValue),
        };
      case "exists":
        return {
          passed: actualValue !== null && actualValue !== "",
          actualValue: String(actualValue),
        };
      default:
        return {
          passed: actualStr === expectedStr,
          actualValue: String(actualValue),
        };
    }
  }

  /**
   * Find a property value in nested object
   */
  private findPropertyValue(
    properties: Record<string, unknown>,
    propertyName: string,
  ): unknown {
    // Normalize property name
    const normalizedName = propertyName.toLowerCase().replace(/\s+/g, "");

    // Direct match
    if (properties[propertyName] !== undefined) {
      return properties[propertyName];
    }

    // Case-insensitive search
    for (const key of Object.keys(properties)) {
      const normalizedKey = key.toLowerCase().replace(/\s+/g, "");
      if (normalizedKey === normalizedName) {
        return properties[key];
      }
    }

    // Search in nested objects
    for (const key of Object.keys(properties)) {
      const value = properties[key];
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nested = this.findPropertyValue(
          value as Record<string, unknown>,
          propertyName,
        );
        if (nested !== null && nested !== undefined) {
          return nested;
        }
      }
    }

    // Common property aliases
    const aliases: Record<string, string[]> = {
      width: ["w", "ancho", "width"],
      height: ["h", "alto", "height"],
      length: ["l", "largo", "length"],
      voltage: ["v", "voltaje", "voltage"],
      power: ["p", "potencia", "power", "watt"],
      current: ["i", "corriente", "current", "amp"],
      diameter: ["d", "diametro", "diameter"],
    };

    for (const [, names] of Object.entries(aliases)) {
      if (names.includes(normalizedName)) {
        for (const alias of names) {
          for (const key of Object.keys(properties)) {
            if (key.toLowerCase().includes(alias)) {
              return properties[key];
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get previous compliance runs for a project
   */
  async getRuns(projectId: string, limit = 10): Promise<unknown[]> {
    return prisma.complianceRun.findMany({
      where: { projectId },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        ruleset: {
          select: { name: true, discipline: true },
        },
        _count: {
          select: { issues: true },
        },
      },
    });
  }

  /**
   * Get issues for a specific run
   */
  async getRunIssues(runId: string): Promise<unknown[]> {
    return prisma.complianceIssue.findMany({
      where: { runId },
      orderBy: [{ severity: "asc" }, { elementCategory: "asc" }],
    });
  }
}

export const complianceRunnerService = new ComplianceRunnerService();
