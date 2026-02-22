-- Hito 5: Batch Conversion Queue System
-- Migration: Add conversion_batch table and update conversion table

-- 1. Create conversion_batch table
CREATE TABLE IF NOT EXISTS conversion_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    queued_at TIMESTAMP,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    
    -- Summary counts
    total_count INTEGER NOT NULL,
    pending_count INTEGER NOT NULL DEFAULT 0,
    queued_count INTEGER NOT NULL DEFAULT 0,
    processing_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes for conversion_batch
CREATE INDEX idx_conversion_batch_user_created ON conversion_batch(user_id, created_at);
CREATE INDEX idx_conversion_batch_created ON conversion_batch(created_at);

-- 2. Add new columns to conversion table
ALTER TABLE "Conversion"ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES conversion_batch(id);
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS method VARCHAR(50) NOT NULL DEFAULT 'modelDerivative';
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS work_item_id VARCHAR(255);
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(500) UNIQUE;
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS queued_at TIMESTAMP;
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE "Conversion" ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;

-- 3. Update existing status values if needed
-- Ensure existing records have valid status
UPDATE "Conversion" SET status = 'PENDING' WHERE status IS NULL;

-- 4. Create indexes for conversion
CREATE INDEX IF NOT EXISTS idx_conversion_batch_status ON "Conversion"(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_conversion_status ON "Conversion"(status);
CREATE INDEX IF NOT EXISTS idx_conversion_work_item_id ON "Conversion"(work_item_id);
CREATE INDEX IF NOT EXISTS idx_conversion_created_at ON "Conversion"(created_at);

-- 5. Add comments for documentation
COMMENT ON TABLE conversion_batch IS 'Tracks batch conversion operations with progress statistics';
COMMENT ON COLUMN conversion_batch.user_id IS 'User who initiated the batch operation';
COMMENT ON COLUMN conversion_batch.total_count IS 'Total number of conversions in this batch';

COMMENT ON COLUMN "Conversion".batch_id IS 'Optional reference to batch operation';
COMMENT ON COLUMN "Conversion".method IS 'Conversion method: modelDerivative or designAutomation';
COMMENT ON COLUMN "Conversion".work_item_id IS 'Design Automation workItemId for exact callback matching';
COMMENT ON COLUMN "Conversion".dedupe_key IS 'Idempotency key for DA callbacks: DA:{workItemId}:{status}';
COMMENT ON COLUMN "Conversion".attempts IS 'Number of retry attempts';
COMMENT ON COLUMN "Conversion".queued_at IS 'Timestamp when job was enqueued';
COMMENT ON COLUMN "Conversion".started_at IS 'Timestamp when worker started processing';
COMMENT ON COLUMN "Conversion".finished_at IS 'Timestamp when job completed or failed';
