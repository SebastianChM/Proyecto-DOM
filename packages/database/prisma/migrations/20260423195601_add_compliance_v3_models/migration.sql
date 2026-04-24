-- AlterTable
ALTER TABLE "ComplianceIssue" ADD COLUMN     "legalReference" TEXT;

-- AlterTable
ALTER TABLE "ComplianceRun" ADD COLUMN     "configId" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "complianceRunId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-CL',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationPack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scope" TEXT[],
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),

    CONSTRAINT "RegulationPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackDocument" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT,
    "docType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "legalReference" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MANDATORY',
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCondition" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "propertyRef" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "tolerance" DOUBLE PRECISION,
    "logicGroup" TEXT NOT NULL DEFAULT 'AND',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicabilityRule" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "targetCategories" TEXT[],
    "excludeCategories" TEXT[],
    "propertyFilters" JSONB,
    "scope" TEXT NOT NULL DEFAULT 'FILTERED',

    CONSTRAINT "ApplicabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyDictionary" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "revitPropertyPath" TEXT,
    "ifcPropertyPath" TEXT,
    "unit" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'NUMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyDictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryDictionary" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "revitCategory" TEXT NOT NULL,
    "ifcEntity" TEXT,
    "discipline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryDictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL,
    "fromUnit" TEXT NOT NULL,
    "toUnit" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectComplianceConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectComplianceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementOverride" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "newValue" TEXT,
    "newSeverity" TEXT,
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectComplianceConfigToRegulationPack" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_organizationId_userId_key" ON "OrgMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationPack_code_key" ON "RegulationPack"("code");

-- CreateIndex
CREATE INDEX "RegulationPack_country_idx" ON "RegulationPack"("country");

-- CreateIndex
CREATE INDEX "RegulationPack_status_idx" ON "RegulationPack"("status");

-- CreateIndex
CREATE INDEX "Requirement_packId_idx" ON "Requirement"("packId");

-- CreateIndex
CREATE INDEX "Requirement_discipline_idx" ON "Requirement"("discipline");

-- CreateIndex
CREATE INDEX "Requirement_status_idx" ON "Requirement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicabilityRule_requirementId_key" ON "ApplicabilityRule"("requirementId");

-- CreateIndex
CREATE INDEX "PropertyDictionary_locale_idx" ON "PropertyDictionary"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyDictionary_canonicalName_locale_key" ON "PropertyDictionary"("canonicalName", "locale");

-- CreateIndex
CREATE INDEX "CategoryDictionary_locale_idx" ON "CategoryDictionary"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryDictionary_canonicalName_locale_key" ON "CategoryDictionary"("canonicalName", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "UnitConversion_fromUnit_toUnit_key" ON "UnitConversion"("fromUnit", "toUnit");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectComplianceConfig_projectId_key" ON "ProjectComplianceConfig"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementOverride_configId_requirementId_key" ON "RequirementOverride"("configId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectComplianceConfigToRegulationPack_AB_unique" ON "_ProjectComplianceConfigToRegulationPack"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectComplianceConfigToRegulationPack_B_index" ON "_ProjectComplianceConfigToRegulationPack"("B");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_complianceRunId_fkey" FOREIGN KEY ("complianceRunId") REFERENCES "ComplianceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRun" ADD CONSTRAINT "ComplianceRun_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ProjectComplianceConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationPack" ADD CONSTRAINT "RegulationPack_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDocument" ADD CONSTRAINT "PackDocument_packId_fkey" FOREIGN KEY ("packId") REFERENCES "RegulationPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_packId_fkey" FOREIGN KEY ("packId") REFERENCES "RegulationPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCondition" ADD CONSTRAINT "RequirementCondition_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicabilityRule" ADD CONSTRAINT "ApplicabilityRule_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementOverride" ADD CONSTRAINT "RequirementOverride_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ProjectComplianceConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementOverride" ADD CONSTRAINT "RequirementOverride_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectComplianceConfigToRegulationPack" ADD CONSTRAINT "_ProjectComplianceConfigToRegulationPack_A_fkey" FOREIGN KEY ("A") REFERENCES "ProjectComplianceConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectComplianceConfigToRegulationPack" ADD CONSTRAINT "_ProjectComplianceConfigToRegulationPack_B_fkey" FOREIGN KEY ("B") REFERENCES "RegulationPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
