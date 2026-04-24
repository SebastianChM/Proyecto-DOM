-- AlterTable: Make ComplianceRun.rulesetId optional for Compliance V3 runs
-- V3 runs reference ProjectComplianceConfig via configId instead of Ruleset via rulesetId
ALTER TABLE "ComplianceRun" ALTER COLUMN "rulesetId" DROP NOT NULL;
