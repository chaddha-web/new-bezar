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

-- 8. Seed Initial Data for Movies
INSERT INTO movies (id, title, genre, year, badge, thumbnail, video_src, description, is_featured)
VALUES
('a34d3ebb-78a2-4ff1-b151-ba7ad4442301', 'Welcome To The Jungle', 'Action · Comedy', '2026', 'Coming Soon', '/thumbnails/welcome-to-the-jungle.jpg', 'https://d2h58dsjpbzmve.cloudfront.net/50kjr%2Ffile%2F130200cb7ba80242a26d4c6e40d01842_1d5150b877ce5fa4fd0f73b36e1ee5d3.mp4?response-content-disposition=inline%3Bfilename%3D%22130200cb7ba80242a26d4c6e40d01842_1d5150b877ce5fa4fd0f73b36e1ee5d3.mp4%22%3B&response-content-type=video%2Fmp4&Expires=1780020030&Signature=csb6p~dbYbMRofCAh2eLFqamGFQCPuH3KMut46lSb02LMjQsdiUeJtFywFHKkjeqLVahp6pE4hd2aEiZ0xW3XKBMONOHTpMwY7e9pSlM41EjO1hfTbNbSOcir61aV5hllVp6~G0WY5OMFV3020biijRiah7M7zfjH0R11EXd7pwyezoaBVWiumrPmD06OAoANcfzpIBFrq0mz28IGlwYqRIc-t7TZdx1Hhg39sSiTy7-DoDgQyqg3c3tZXSqLX5jS6~zlhD7dqb31pZ2ztka8fzeaSNa2PNh8v01fGADUuBpY1E~y0t~ecCHJRCC~5Cs2EROSu0PGOw4oWomfBim0A__&Key-Pair-Id=APKAJT5WQLLEOADKLHBQ', 'The wildest adventure of the year — arriving June 26, 2026.', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO movies (id, title, genre, year, badge, thumbnail, video_src, description, is_featured)
VALUES
('b34d3ebb-78a2-4ff1-b151-ba7ad4442302', 'Dangal', 'Drama · Sport', '2016', 'Coming Soon', '/thumbnails/dangal.jpg', 'https://bucket-d4d96s.s3.us-east-1.amazonaws.com/Dangal%20%20Official%20Trailer%20%20Aamir%20Khan%20%20In%20Cinemas%20Dec%2023,%202016%20-%20UTV%20Motion%20Pictures%20(1080p,%20h264).mp4', 'A father''s dream. A daughter''s destiny.', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO movies (id, title, genre, year, badge, thumbnail, video_src, description, is_featured)
VALUES
('c34d3ebb-78a2-4ff1-b151-ba7ad4442303', 'Disclosure Day', 'Sci-Fi · Thriller', '2025', 'Coming Soon', '/thumbnails/disclosure-day.jpg', 'https://d2n7fc0kw20ri7.cloudfront.net/33hjr%2Ffile%2F12b4b2f204aa7cf9c75bf8ef0b70e893_fbe9a31936719fd602fad278a07cb9f2.mp4?response-content-disposition=inline%3Bfilename%3D%2212b4b2f204aa7cf9c75bf8ef0b70e893_fbe9a31936719fd602fad278a07cb9f2.mp4%22%3B&response-content-type=video%2Fmp4&Expires=1780019951&Signature=TGRNrGF14HN2tDlSg3GX6cLK5hvKbSJPtt29pq8pfICyD3MmH7bdrN0S4djrdqxx0ItpzUs2iWG4R8maqGDriuYxu~oMAVmDpKO5qESGjR5N5XN2udTy2vLPBNxDhY~~1FHwFJ~bhratdErNyixsSPuyiVC-2Itg-2sn7cxQKyni-qpF51h4hm3gy~uxAgOsKwl25vEnib7hKe~N7lUIJguPUv-3dBebTL4NGFotTqNwACLNzdkklFHRsZAz~RqVq-7KD1eY1W86PQO2PkR0ZdiivBj0Vf9geHHjQ9f44SgbU5hIAi3qIRQZoJMQH0pRwfv6sTK2OZXRlAW3cV~KqQ__&Key-Pair-Id=APKAJT5WQLLEOADKLHBQ', 'The truth was never meant to be found.', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO movies (id, title, genre, year, badge, thumbnail, video_src, description, is_featured)
VALUES
('d34d3ebb-78a2-4ff1-b151-ba7ad4442304', 'Governor', 'Political Thriller', '2025', 'Coming Soon', '/thumbnails/governor.jpg', 'https://bucket-d4d96s.s3.us-east-1.amazonaws.com/GOVERNOR%20%20Official%20Trailer%20%20Manoj%20Bajpayee%20%20Vipul%20Amrutlal%20Shah%20Chinmay%20Mandlekar%20Aashin%20A%20Shah%20-%20Sunshine%20Pictures%20(1080p,%20h264).mp4', 'Power has a price. Every seat costs a soul.', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO movies (id, title, genre, year, badge, thumbnail, video_src, description, is_featured)
VALUES
('e34d3ebb-78a2-4ff1-b151-ba7ad4442305', 'Gully Boy', 'Drama · Music', '2019', 'Coming Soon', '/thumbnails/gully-boy.jpg', 'https://bucket-d4d96s.s3.us-east-1.amazonaws.com/Gully%20Boy%20%20Official%20Trailer%20%20Ranveer%20Singh%20%20Alia%20Bhatt%20%20Zoya%20Akhtar%2014th%20February%20-%20Excel%20Movies%20(1080p,%20h264).mp4', 'From the streets to the stage.', FALSE)
ON CONFLICT (id) DO NOTHING;

