-- ============================================================
-- DOMAIN / IP MONITORING SERVICE - DATABASE SCHEMA
-- ============================================================

-- Monitored targets registered by customers
CREATE TABLE monitored_targets (
    id                      SERIAL PRIMARY KEY,
    customer_id             INT NOT NULL,                          -- FK to customers table
    target                  VARCHAR(255) NOT NULL,                 -- e.g. "example.com" or "1.2.3.4"
    target_type             VARCHAR(10) NOT NULL                   -- 'DOMAIN' or 'IP'
                            CHECK (target_type IN ('DOMAIN', 'IP')),
    protocol                VARCHAR(10) NOT NULL DEFAULT 'HTTP'    -- 'HTTP', 'HTTPS', 'PING', 'TCP'
                            CHECK (protocol IN ('HTTP', 'HTTPS', 'PING', 'TCP')),
    port                    INT DEFAULT NULL,                      -- optional port for TCP checks
    notification_email      VARCHAR(255) NOT NULL,                 -- alert email entered by customer
    check_interval_seconds  INT NOT NULL DEFAULT 60,               -- how often to check (min: 30)
    timeout_seconds         INT NOT NULL DEFAULT 10,               -- timeout per check
    failure_threshold       INT NOT NULL DEFAULT 2,                -- consecutive failures before alert
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    current_status          VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN' -- 'UP', 'DOWN', 'UNKNOWN'
                            CHECK (current_status IN ('UP', 'DOWN', 'UNKNOWN')),
    consecutive_failures    INT NOT NULL DEFAULT 0,                -- resets to 0 on success
    last_checked_at         TIMESTAMP DEFAULT NULL,
    last_status_change_at   TIMESTAMP DEFAULT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customer_target UNIQUE (customer_id, target, protocol, port)
);

-- Index to efficiently fetch targets due for checking
CREATE INDEX idx_monitored_targets_active_next_check
    ON monitored_targets (is_active, last_checked_at, check_interval_seconds);

-- Index for customer lookups
CREATE INDEX idx_monitored_targets_customer
    ON monitored_targets (customer_id);


-- History of every check performed (up or down)
CREATE TABLE status_history (
    id                SERIAL PRIMARY KEY,
    target_id         INT NOT NULL REFERENCES monitored_targets(id) ON DELETE CASCADE,
    status            VARCHAR(10) NOT NULL CHECK (status IN ('UP', 'DOWN')),
    response_time_ms  INT DEFAULT NULL,                            -- null if down / timed out
    error_message     VARCHAR(500) DEFAULT NULL,                   -- e.g. "Connection timed out"
    http_status_code  INT DEFAULT NULL,                            -- e.g. 200, 503
    checked_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fetching history of a specific target efficiently
CREATE INDEX idx_status_history_target_time
    ON status_history (target_id, checked_at DESC);


-- Log of all alert emails sent
CREATE TABLE alert_emails_log (
    id              SERIAL PRIMARY KEY,
    target_id       INT NOT NULL REFERENCES monitored_targets(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    email_type      VARCHAR(20) NOT NULL CHECK (email_type IN ('DOWN', 'RECOVERED')),
    subject         VARCHAR(500) NOT NULL,
    sent_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT'            -- 'SENT', 'FAILED', 'RETRYING'
                    CHECK (delivery_status IN ('SENT', 'FAILED', 'RETRYING')),
    error_message   VARCHAR(500) DEFAULT NULL
);

-- Index for auditing emails per target
CREATE INDEX idx_alert_emails_log_target
    ON alert_emails_log (target_id, sent_at DESC);
