/*
  Warnings:

  - You are about to drop the column `storageSize` on the `ApsVersion` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Project` table. All the data in the column will be lost.
  - Added the required column `validationType` to the `ApsVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrn" TEXT,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalElements" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "mismatchCount" INTEGER NOT NULL DEFAULT 0,
    "undocumentedCount" INTEGER NOT NULL DEFAULT 0,
    "validationType" TEXT NOT NULL,
    "validationRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "validationRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "elementTag" TEXT,
    "elementType" TEXT,
    "elementId" TEXT,
    "message" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "resolutionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ValidationIssue_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "invitedBy" TEXT,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "validationRunId" TEXT,
    "issueId" TEXT,
    "fileId" TEXT,
    "projectId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkflowState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "requiredRole" TEXT,
    "onEnterActions" TEXT,
    CONSTRAINT "WorkflowState_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "fromStateId" TEXT NOT NULL,
    "toStateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "buttonVariant" TEXT NOT NULL DEFAULT 'default',
    "requiredRole" TEXT,
    "conditions" TEXT,
    "actions" TEXT,
    "requireComment" BOOLEAN NOT NULL DEFAULT false,
    "requireConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmationMessage" TEXT,
    CONSTRAINT "WorkflowTransition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowTransition_fromStateId_fkey" FOREIGN KEY ("fromStateId") REFERENCES "WorkflowState" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowTransition_toStateId_fkey" FOREIGN KEY ("toStateId") REFERENCES "WorkflowState" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentStateId" TEXT NOT NULL,
    "currentStateName" TEXT NOT NULL,
    "currentStateDisplay" TEXT NOT NULL,
    "currentStateColor" TEXT NOT NULL DEFAULT '#6B7280',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "startedBy" TEXT,
    CONSTRAINT "WorkflowInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkflowInstance_currentStateId_fkey" FOREIGN KEY ("currentStateId") REFERENCES "WorkflowState" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "fromStateName" TEXT NOT NULL,
    "fromStateDisplay" TEXT NOT NULL,
    "toStateName" TEXT NOT NULL,
    "toStateDisplay" TEXT NOT NULL,
    "transitionName" TEXT,
    "transitionDisplay" TEXT,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "performedByEmail" TEXT,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "metadata" TEXT,
    "durationInPreviousState" INTEGER,
    CONSTRAINT "WorkflowHistory_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApsVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "urn" TEXT NOT NULL,
    "mimeType" TEXT,
    "validationType" TEXT NOT NULL,
    "validationRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ApsVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ApsItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ApsVersion" ("createdAt", "id", "itemId", "mimeType", "urn", "versionNumber") SELECT "createdAt", "id", "itemId", "mimeType", "urn", "versionNumber" FROM "ApsVersion";
DROP TABLE "ApsVersion";
ALTER TABLE "new_ApsVersion" RENAME TO "ApsVersion";
CREATE INDEX "ApsVersion_createdAt_idx" ON "ApsVersion"("createdAt");
CREATE TABLE "new_File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER,
    "s3Key" TEXT,
    "apsUrn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "origin" TEXT NOT NULL DEFAULT 'LOCAL',
    "apsProjectId" TEXT,
    "apsItemId" TEXT,
    "apsHubId" TEXT,
    "apsFolderId" TEXT,
    "apsStorageId" TEXT,
    "projectId" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "File_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_File" ("apsFolderId", "apsHubId", "apsItemId", "apsProjectId", "apsStorageId", "apsUrn", "createdAt", "id", "name", "originalName", "projectId", "s3Key", "size", "status", "type", "updatedAt") SELECT "apsFolderId", "apsHubId", "apsItemId", "apsProjectId", "apsStorageId", "apsUrn", "createdAt", "id", "name", "originalName", "projectId", "s3Key", "size", "status", "type", "updatedAt" FROM "File";
DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
CREATE INDEX "File_projectId_idx" ON "File"("projectId");
CREATE INDEX "File_status_idx" ON "File"("status");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "clientName" TEXT,
    "location" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "discipline" TEXT,
    "ownerId" TEXT NOT NULL,
    "isFromAutodesk" BOOLEAN NOT NULL DEFAULT false,
    "apsOwnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ValidationRun_fileId_idx" ON "ValidationRun"("fileId");

-- CreateIndex
CREATE INDEX "ValidationRun_projectId_idx" ON "ValidationRun"("projectId");

-- CreateIndex
CREATE INDEX "ValidationRun_userId_idx" ON "ValidationRun"("userId");

-- CreateIndex
CREATE INDEX "ValidationRun_createdAt_idx" ON "ValidationRun"("createdAt");

-- CreateIndex
CREATE INDEX "ValidationIssue_validationRunId_idx" ON "ValidationIssue"("validationRunId");

-- CreateIndex
CREATE INDEX "ValidationIssue_type_idx" ON "ValidationIssue"("type");

-- CreateIndex
CREATE INDEX "ValidationIssue_status_idx" ON "ValidationIssue"("status");

-- CreateIndex
CREATE INDEX "ValidationIssue_severity_idx" ON "ValidationIssue"("severity");

-- CreateIndex
CREATE INDEX "ValidationIssue_elementTag_idx" ON "ValidationIssue"("elementTag");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_code_key" ON "WorkflowTemplate"("code");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_entityType_isActive_idx" ON "WorkflowTemplate"("entityType", "isActive");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_isDefault_entityType_idx" ON "WorkflowTemplate"("isDefault", "entityType");

-- CreateIndex
CREATE INDEX "WorkflowState_templateId_order_idx" ON "WorkflowState"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowState_templateId_name_key" ON "WorkflowState"("templateId", "name");

-- CreateIndex
CREATE INDEX "WorkflowTransition_templateId_idx" ON "WorkflowTransition"("templateId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_fromStateId_idx" ON "WorkflowTransition"("fromStateId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTransition_templateId_fromStateId_toStateId_key" ON "WorkflowTransition"("templateId", "fromStateId", "toStateId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_currentStateName_idx" ON "WorkflowInstance"("currentStateName");

-- CreateIndex
CREATE INDEX "WorkflowInstance_entityType_status_idx" ON "WorkflowInstance"("entityType", "status");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_entityType_entityId_key" ON "WorkflowInstance"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkflowHistory_instanceId_performedAt_idx" ON "WorkflowHistory"("instanceId", "performedAt");

-- CreateIndex
CREATE INDEX "WorkflowHistory_performedById_idx" ON "WorkflowHistory"("performedById");

-- CreateIndex
CREATE INDEX "WorkflowHistory_performedAt_idx" ON "WorkflowHistory"("performedAt");
