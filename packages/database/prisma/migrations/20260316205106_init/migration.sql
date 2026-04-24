-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apsUserId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "clientName" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "discipline" TEXT,
    "ownerId" TEXT NOT NULL,
    "isFromAutodesk" BOOLEAN NOT NULL DEFAULT false,
    "apsOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER,
    "s3Key" TEXT,
    "localPath" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVersion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "apsUrn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "batchId" TEXT,
    "targetFormat" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "workItemId" TEXT,
    "dedupeKey" TEXT,
    "resultUrn" TEXT,
    "resultUrl" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "baseFileId" TEXT NOT NULL,
    "targetFileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "diffId" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApsHub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApsHub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApsProject" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApsProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApsFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApsFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApsItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApsVersion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "urn" TEXT NOT NULL,
    "mimeType" TEXT,
    "validationType" TEXT NOT NULL,
    "validationRules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ApsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL,
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
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "validationRunId" TEXT,
    "issueId" TEXT,
    "fileId" TEXT,
    "projectId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowState" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentStateId" TEXT NOT NULL,
    "currentStateName" TEXT NOT NULL,
    "currentStateDisplay" TEXT NOT NULL,
    "currentStateColor" TEXT NOT NULL DEFAULT '#6B7280',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "startedBy" TEXT,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowHistory" (
    "id" TEXT NOT NULL,
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
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "metadata" TEXT,
    "durationInPreviousState" INTEGER,

    CONSTRAINT "WorkflowHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruleset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discipline" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ruleset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetCategory" TEXT NOT NULL,
    "targetNamePattern" TEXT,
    "propertyName" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "expectedValue" TEXT NOT NULL,
    "unit" TEXT,
    "tolerance" DOUBLE PRECISION,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "sourceDocument" TEXT,
    "sourcePage" INTEGER,
    "rulesetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileId" TEXT,
    "extractedData" TEXT,
    "extractedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRun" (
    "id" TEXT NOT NULL,
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
    "complianceScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "errorMessage" TEXT,
    "projectId" TEXT NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ComplianceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceIssue" (
    "id" TEXT NOT NULL,
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
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "hookId" TEXT,
    "deliveryId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "requestId" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "resourceId" TEXT,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aps_poll_cursor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastVersionId" TEXT,
    "pollStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastPollAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aps_poll_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_batch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totalCount" INTEGER NOT NULL,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "processingCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "conversion_batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_apsUserId_idx" ON "User"("apsUserId");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "File_projectId_idx" ON "File"("projectId");

-- CreateIndex
CREATE INDEX "File_status_idx" ON "File"("status");

-- CreateIndex
CREATE INDEX "File_apsUrn_idx" ON "File"("apsUrn");

-- CreateIndex
CREATE UNIQUE INDEX "FileVersion_fileId_version_key" ON "FileVersion"("fileId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_workItemId_key" ON "Conversion"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_dedupeKey_key" ON "Conversion"("dedupeKey");

-- CreateIndex
CREATE INDEX "Conversion_batchId_status_idx" ON "Conversion"("batchId", "status");

-- CreateIndex
CREATE INDEX "Conversion_status_idx" ON "Conversion"("status");

-- CreateIndex
CREATE INDEX "Conversion_createdAt_idx" ON "Conversion"("createdAt");

-- CreateIndex
CREATE INDEX "ApsVersion_createdAt_idx" ON "ApsVersion"("createdAt");

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

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_dedupeKey_key" ON "webhook_delivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "webhook_delivery_status_idx" ON "webhook_delivery"("status");

-- CreateIndex
CREATE INDEX "webhook_delivery_dedupeKey_idx" ON "webhook_delivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "webhook_delivery_receivedAt_idx" ON "webhook_delivery"("receivedAt");

-- CreateIndex
CREATE INDEX "notification_event_type_idx" ON "notification_event"("type");

-- CreateIndex
CREATE INDEX "notification_event_projectId_idx" ON "notification_event"("projectId");

-- CreateIndex
CREATE INDEX "notification_event_createdAt_idx" ON "notification_event"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "aps_poll_cursor_projectId_key" ON "aps_poll_cursor"("projectId");

-- CreateIndex
CREATE INDEX "aps_poll_cursor_pollStatus_idx" ON "aps_poll_cursor"("pollStatus");

-- CreateIndex
CREATE INDEX "conversion_batch_userId_createdAt_idx" ON "conversion_batch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "conversion_batch_createdAt_idx" ON "conversion_batch"("createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "conversion_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_baseFileId_fkey" FOREIGN KEY ("baseFileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_targetFileId_fkey" FOREIGN KEY ("targetFileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApsProject" ADD CONSTRAINT "ApsProject_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "ApsHub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApsFolder" ADD CONSTRAINT "ApsFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ApsProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApsFolder" ADD CONSTRAINT "ApsFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ApsFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApsItem" ADD CONSTRAINT "ApsItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ApsFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApsItem" ADD CONSTRAINT "ApsItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ApsProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApsVersion" ADD CONSTRAINT "ApsVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ApsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationIssue" ADD CONSTRAINT "ValidationIssue_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowState" ADD CONSTRAINT "WorkflowState_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStateId_fkey" FOREIGN KEY ("fromStateId") REFERENCES "WorkflowState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStateId_fkey" FOREIGN KEY ("toStateId") REFERENCES "WorkflowState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_currentStateId_fkey" FOREIGN KEY ("currentStateId") REFERENCES "WorkflowState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowHistory" ADD CONSTRAINT "WorkflowHistory_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "Ruleset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRun" ADD CONSTRAINT "ComplianceRun_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "Ruleset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIssue" ADD CONSTRAINT "ComplianceIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ComplianceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
