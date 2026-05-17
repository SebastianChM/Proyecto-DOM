-- Migration: add_dashboard_and_performance_indexes
--
-- Adds indexes for fields used by /dashboard/stats queries:
--   File.type        → activeModels filter (type IN [...])
--   File.createdAt   → trend period filters (createdAt >= thirtyDaysAgo)
--   File.updatedAt   → processingCount 4h window + activeModels trend
--   Project.createdAt → project trend period filters
--   Project.updatedAt → recentProjects ORDER BY updatedAt DESC

-- File indexes
CREATE INDEX "File_type_idx" ON "File"("type");
CREATE INDEX "File_createdAt_idx" ON "File"("createdAt");
CREATE INDEX "File_updatedAt_idx" ON "File"("updatedAt");

-- Project indexes
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");
