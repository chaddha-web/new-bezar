-- SQL Schema for Bezar OTT Platform
-- Supports Movies, Live Channels, Users, Subscriptions, and watch time metrics.

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE, -- set true once the signup magic link is clicked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.1 Create CMS Staff Users Table
CREATE TABLE IF NOT EXISTS cms_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.5 Create Auth Tokens Table for Magic Links
CREATE TABLE IF NOT EXISTS auth_tokens (
    token VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) DEFAULT 'Free',
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'canceled'
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Movies Table
CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    genre VARCHAR(255) NOT NULL,
    year VARCHAR(10) NOT NULL,
    badge VARCHAR(50) DEFAULT 'Coming Soon',
    thumbnail TEXT NOT NULL,
    video_src TEXT,
    description TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'PUBLISHED'
    content_type VARCHAR(50) DEFAULT 'MOVIE', -- 'MOVIE', 'SERIES'
    trailer_src TEXT,
    runtime INT DEFAULT 0, -- in seconds
    episodes JSONB, -- stores array of episode objects
    tags VARCHAR(255),
    ratings VARCHAR(50),
    credits TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Live Channels Table
CREATE TABLE IF NOT EXISTS live_channels (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    logo TEXT NOT NULL,
    video_src TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Watch Time Tracking Table (Debounced Analytics)
CREATE TABLE IF NOT EXISTS watch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
    watched_seconds INT DEFAULT 0,
    last_position_seconds INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id)
);

-- 7. Seed Initial Data for Live Channels
INSERT INTO live_channels (id, title, genre, logo, video_src, description)
VALUES 
('india-daily-live', 'India Daily Live', 'Hindi News', 'https://jiotvimages.cdn.jio.com/dare_images/images/India_Daily_24x7.png', 'https://indiadaily.ottlive.co.in/indiadailylive/index.m3u8', 'Breaking news, headlines, and live coverage 24/7.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO live_channels (id, title, genre, logo, video_src, description)
VALUES 
('aaj-tak', 'Aaj Tak HD', 'Hindi News', 'https://jiotvimages.cdn.jio.com/dare_images/images/Aaj_Tak.png', 'https://feeds.intoday.in/aajtak/api/aajtakhd/master.m3u8', 'India''s #1 Hindi news channel — live, 24/7.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO live_channels (id, title, genre, logo, video_src, description)
VALUES 
('abp-news', 'ABP News', 'Hindi News', 'https://jiotvimages.cdn.jio.com/dare_images/images/ABP_News.png', 'https://d2l4ar6y3mrs4k.cloudfront.net/live-streaming/abpnews-livetv/master.m3u8', 'Breaking news, politics, and analysis live from ABP.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO live_channels (id, title, genre, logo, video_src, description)
VALUES 
('india-tv', 'India TV', 'Hindi News', 'https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_INDIA_TV/images/LOGO_HD/image.png', 'https://pl-indiatvnews.akamaized.net/out/v1/db79179b608641ceaa5a4d0dd0dca8da/index.m3u8', 'India TV — Sach Dikhata Hai. Live round-the-clock.')
ON CONFLICT (id) DO NOTHING;

-- 8. Removed placeholder movies seeding to allow CMS to manage all content.

-- 9. Create MLM Nodes Table (Web3 BEP-20 Ledger Optimized)
CREATE TABLE IF NOT EXISTS mlm_nodes (
    node_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Sponsor upline
    investment_amount_usd DECIMAL(15, 2) DEFAULT 100.00, -- Stablecoins ($100 baseline pack)
    investment_amount_inr DECIMAL(15, 2) DEFAULT 9400.00, -- 1 USD = 94 INR fixed conversion
    accumulated_earnings_usd DECIMAL(15, 2) DEFAULT 0.00, -- Total Stablecoins earned
    accumulated_earnings_inr DECIMAL(15, 2) DEFAULT 0.00,
    wallet_balance_usd DECIMAL(15, 2) DEFAULT 0.00, -- Withdrawable Stablecoin balance
    wallet_balance_inr DECIMAL(15, 2) DEFAULT 0.00,
    node_status VARCHAR(50) DEFAULT 'ACTIVE', -- 'PENDING', 'ACTIVE', 'EXPIRED'
    accelerator_mode VARCHAR(50) DEFAULT 'STANDARD', -- 'STANDARD', 'FAST_FORWARD'
    current_rank VARCHAR(20) DEFAULT 'R1', -- 'R1' through 'R7'
    bsc_deposit_address VARCHAR(42) UNIQUE, -- Unique user BNB Smart Chain depot
    user_payout_address VARCHAR(42), -- Designated Web3 address to receive payouts
    username VARCHAR(50), -- Affiliate handle; NULL until the user joins the affiliate program
    currency_preference VARCHAR(10) DEFAULT 'INR', -- 'INR' | 'USDT' | 'USDC'
    withdrawal_pin_hash VARCHAR(255), -- bcrypt hash of the 4–6 digit cash-out PIN, set at onboarding
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive uniqueness for affiliate usernames (allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mlm_username_lower ON mlm_nodes (LOWER(username));

-- 10. Create Daily Engagement Telemetry Trackers
CREATE TABLE IF NOT EXISTS daily_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    audio_duration_seconds INT DEFAULT 0,
    video_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- 11. Create Core Wallet Ledger System (Web3 BEP-20 Transaction Audits)
CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount_usd DECIMAL(15, 2) NOT NULL, -- Stablecoins credit/debit
    amount_inr DECIMAL(15, 2) NOT NULL,
    transaction_type VARCHAR(100) NOT NULL, -- 'YIELD', 'DIRECT_REFERRAL', 'MATCHING_COMMISSION', 'PEER_MATCH_OVERRIDE', 'WITHDRAWAL'
    reference_node_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Downstream reference
    bsc_tx_hash VARCHAR(66) UNIQUE, -- BNB Smart Chain transaction hash
    token_symbol VARCHAR(10) DEFAULT 'USDT', -- 'USDT' or 'USDC'
    idempotency_key VARCHAR(100) UNIQUE, -- Deduplication guard for API retries
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11.5 System Settings (admin-tunable key/value config)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default tunables (do not overwrite existing operator-set values)
INSERT INTO system_settings (key, value) VALUES ('MIN_HOLD_USD', '100') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value) VALUES ('MAX_INR_TRANSACTION', '30000') ON CONFLICT (key) DO NOTHING;

-- Indexing for high-speed unilevel hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_mlm_nodes_parent ON mlm_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_node ON wallet_ledger(node_id);
CREATE INDEX IF NOT EXISTS idx_daily_engagement_user_date ON daily_engagement(user_id, date);

-- 12. Idempotency Constraint: Physically prevent double-yields on the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_yield ON wallet_ledger(node_id, (CAST(created_at AT TIME ZONE 'UTC' AS DATE))) WHERE transaction_type = 'YIELD';

-- 13. Company Crypto Wallets & Rotation Queue
CREATE TABLE IF NOT EXISTS company_crypto_wallets (
    address VARCHAR(42) PRIMARY KEY,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) REFERENCES company_crypto_wallets(address) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial 4 wallets provided by user
INSERT INTO company_crypto_wallets (address) VALUES 
('0x73E47F7537E79763d409A69D237376bb679FD905'),
('0x78E469A677383Aba855B07Fc206C55fb8b575b60'),
('0x63839E0EA4f01eFEE4a882ba40Fa6eBCc4F4a58E'),
('0x7e32e2989fbA638b57A29916ca0cc347d83eB37C')
ON CONFLICT (address) DO NOTHING;
