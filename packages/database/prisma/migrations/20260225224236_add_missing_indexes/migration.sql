-- Add missing indexes and unique constraints
-- PR6: chore/add-missing-db-indexes

-- User: index on apsUserId (used in APS sync lookups)
CREATE INDEX "User_apsUserId_idx" ON "User"("apsUserId");

-- File: index on apsUrn (used in viewer comparisons and APS sync)
CREATE INDEX "File_apsUrn_idx" ON "File"("apsUrn");

-- Conversion: make workItemId unique (used for exact DA callback matching)
-- Note: PostgreSQL allows multiple NULLs in unique columns, which is correct
-- since only DA conversions have a workItemId set.
-- This replaces the previous non-unique @@index([workItemId]).
DROP INDEX IF EXISTS "Conversion_workItemId_idx";
CREATE UNIQUE INDEX "Conversion_workItemId_key" ON "Conversion"("workItemId");
