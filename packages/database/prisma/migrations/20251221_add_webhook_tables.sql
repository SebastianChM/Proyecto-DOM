-- Migration: Add webhook tables for enterprise-grade event processing
-- Created: 2025-12-21

-- WebhookDelivery: Track all incoming webhook deliveries
CREATE TABLE webhook_delivery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    hook_id VARCHAR(255),
    delivery_id VARCHAR(255),
    dedupe_key VARCHAR(500) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    request_id VARCHAR(100),
    duration_ms INT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_delivery_status ON webhook_delivery(status);
CREATE INDEX idx_webhook_delivery_dedupe ON webhook_delivery(dedupe_key);
CREATE INDEX idx_webhook_delivery_received_at ON webhook_delivery(received_at);

-- NotificationEvent: Persistent notification/event log
CREATE TABLE notification_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL,
    project_id UUID,
    resource_id VARCHAR(500),
    payload JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_event_type ON notification_event(type);
CREATE INDEX idx_notification_event_project ON notification_event(project_id);
CREATE INDEX idx_notification_event_created ON notification_event(created_at);

-- ApsPollCursor: Polling state per APS project
CREATE TABLE aps_poll_cursor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(255) NOT NULL UNIQUE,
    last_seen_at TIMESTAMP NOT NULL,
    last_version_id VARCHAR(500),
    poll_status VARCHAR(50) DEFAULT 'ACTIVE',
    last_poll_at TIMESTAMP,
    error_count INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aps_poll_cursor_status ON aps_poll_cursor(poll_status);
