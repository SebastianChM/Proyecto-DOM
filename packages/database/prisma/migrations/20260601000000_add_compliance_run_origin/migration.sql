-- AddColumn: origin discriminator on ComplianceRun
-- Allows ValidationRun writes to migrate to ComplianceRun without breaking existing rows.
-- Default "compliance" keeps all existing rows unchanged.

ALTER TABLE "ComplianceRun" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'compliance';

-- Index for efficient queries filtered by origin
CREATE INDEX "ComplianceRun_origin_idx" ON "ComplianceRun"("origin");
