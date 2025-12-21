-- CreateTable
CREATE TABLE "Ruleset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discipline" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetCategory" TEXT NOT NULL,
    "targetNamePattern" TEXT,
    "propertyName" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "expectedValue" TEXT NOT NULL,
    "unit" TEXT,
    "tolerance" REAL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "sourceDocument" TEXT,
    "sourcePage" INTEGER,
    "rulesetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rule_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "Ruleset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileId" TEXT,
    "extractedData" TEXT,
    "extractedAt" DATETIME,
    "reviewedAt" DATETIME,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ComplianceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "modelUrn" TEXT NOT NULL,
    "modelName" TEXT,
    "rulesetId" TEXT NOT NULL,
    "totalElements" INTEGER,
    "totalRules" INTEGER,
    "passedCount" INTEGER,
    "failedCount" INTEGER,
    "warningCount" INTEGER,
    "complianceScore" REAL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "duration" INTEGER,
    "errorMessage" TEXT,
    "projectId" TEXT NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "ComplianceRun_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "Ruleset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleId" TEXT,
    "elementId" INTEGER NOT NULL,
    "elementName" TEXT NOT NULL,
    "elementCategory" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "expectedValue" TEXT NOT NULL,
    "actualValue" TEXT NOT NULL,
    "deviation" REAL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ComplianceRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Ruleset_discipline_idx" ON "Ruleset"("discipline");

-- CreateIndex
CREATE INDEX "Ruleset_projectId_idx" ON "Ruleset"("projectId");

-- CreateIndex
CREATE INDEX "Rule_rulesetId_idx" ON "Rule"("rulesetId");

-- CreateIndex
CREATE INDEX "Rule_targetCategory_idx" ON "Rule"("targetCategory");

-- CreateIndex
CREATE INDEX "DataSource_projectId_idx" ON "DataSource"("projectId");

-- CreateIndex
CREATE INDEX "DataSource_status_idx" ON "DataSource"("status");

-- CreateIndex
CREATE INDEX "ComplianceRun_projectId_idx" ON "ComplianceRun"("projectId");

-- CreateIndex
CREATE INDEX "ComplianceRun_status_idx" ON "ComplianceRun"("status");

-- CreateIndex
CREATE INDEX "ComplianceRun_rulesetId_idx" ON "ComplianceRun"("rulesetId");

-- CreateIndex
CREATE INDEX "ComplianceIssue_runId_idx" ON "ComplianceIssue"("runId");

-- CreateIndex
CREATE INDEX "ComplianceIssue_severity_idx" ON "ComplianceIssue"("severity");

-- CreateIndex
CREATE INDEX "ComplianceIssue_status_idx" ON "ComplianceIssue"("status");

-- CreateIndex
CREATE INDEX "ComplianceIssue_elementCategory_idx" ON "ComplianceIssue"("elementCategory");
