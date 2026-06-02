-- Migration 003: system_settings table + default tunables
-- Idempotent — safe to run against an existing Bezar database.
--   docker compose exec -T db psql -U postgres -d bezar < db/migrations/003_system_settings.sql

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value) VALUES ('MIN_HOLD_USD', '100') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value) VALUES ('MAX_INR_TRANSACTION', '30000') ON CONFLICT (key) DO NOTHING;
