-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ComplianceIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleId" TEXT,
    "elementId" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "elementCategory" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "expectedValue" TEXT NOT NULL,
    "actualValue" TEXT NOT NULL,
    "deviation" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ComplianceRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ComplianceIssue" ("actualValue", "createdAt", "deviation", "elementCategory", "elementId", "elementName", "expectedValue", "id", "propertyName", "resolutionNote", "resolvedAt", "resolvedBy", "ruleId", "ruleName", "runId", "severity", "status") SELECT "actualValue", "createdAt", "deviation", "elementCategory", "elementId", "elementName", "expectedValue", "id", "propertyName", "resolutionNote", "resolvedAt", "resolvedBy", "ruleId", "ruleName", "runId", "severity", "status" FROM "ComplianceIssue";
DROP TABLE "ComplianceIssue";
ALTER TABLE "new_ComplianceIssue" RENAME TO "ComplianceIssue";
CREATE INDEX "ComplianceIssue_runId_idx" ON "ComplianceIssue"("runId");
CREATE INDEX "ComplianceIssue_severity_idx" ON "ComplianceIssue"("severity");
CREATE INDEX "ComplianceIssue_status_idx" ON "ComplianceIssue"("status");
CREATE INDEX "ComplianceIssue_elementCategory_idx" ON "ComplianceIssue"("elementCategory");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
