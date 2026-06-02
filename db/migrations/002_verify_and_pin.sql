-- Migration 002: Email verification flag + affiliate withdrawal PIN
-- Idempotent — safe to run against an existing Bezar database.
--   docker compose exec -T db psql -U postgres -d bezar < db/migrations/002_verify_and_pin.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE mlm_nodes ADD COLUMN IF NOT EXISTS withdrawal_pin_hash VARCHAR(255);
