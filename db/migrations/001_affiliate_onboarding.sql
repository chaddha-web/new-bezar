-- Migration 001: Affiliate onboarding identity fields
-- Idempotent — safe to run against an existing Bezar database.
-- Usage (local):
--   docker compose exec -T db psql -U postgres -d bezar < db/migrations/001_affiliate_onboarding.sql

ALTER TABLE mlm_nodes ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE mlm_nodes ADD COLUMN IF NOT EXISTS currency_preference VARCHAR(10) DEFAULT 'INR';

-- Case-insensitive uniqueness for affiliate usernames (NULLs allowed for users
-- who have not yet joined the affiliate program).
CREATE UNIQUE INDEX IF NOT EXISTS idx_mlm_username_lower ON mlm_nodes (LOWER(username));
