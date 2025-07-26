-- PostgreSQL Database Schema for VideoStream Pro
-- YouTube-level streaming platform database design

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- User Management
CREATE TYPE user_role AS ENUM ('user', 'creator', 'moderator', 'admin', 'super_admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned', 'deleted');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    status account_status DEFAULT 'active',
    
    -- Profile information
    display_name VARCHAR(100),
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    website_url TEXT,
    
    -- Verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    creator_verified verification_status DEFAULT 'pending',
    verification_badge BOOLEAN DEFAULT FALSE,
    
    -- Security
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    
    -- Privacy settings
    profile_public BOOLEAN DEFAULT TRUE,
    show_subscribers BOOLEAN DEFAULT TRUE,
    allow_comments BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- User analytics and metrics
CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subscriber metrics
    subscribers_count INTEGER DEFAULT 0,
    subscriptions_count INTEGER DEFAULT 0,
    
    -- Content metrics
    videos_count INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    total_likes BIGINT DEFAULT 0,
    total_comments BIGINT DEFAULT 0,
    
    -- Engagement metrics
    average_watch_time INTERVAL,
    engagement_rate DECIMAL(5,4),
    
    -- Revenue metrics (for creators)
    total_revenue DECIMAL(12,2) DEFAULT 0,
    this_month_revenue DECIMAL(12,2) DEFAULT 0,
    
    -- Updated daily
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OAuth providers
CREATE TABLE user_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'facebook', 'apple', 'twitter'
    provider_account_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(provider, provider_account_id)
);

-- Video Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    color_hex VARCHAR(7), -- #RRGGBB
    parent_id UUID REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video management
CREATE TYPE video_status AS ENUM ('draft', 'processing', 'published', 'unlisted', 'private', 'removed');
CREATE TYPE video_visibility AS ENUM ('public', 'unlisted', 'private', 'scheduled');
CREATE TYPE content_rating AS ENUM ('general', 'teen', 'mature', 'adult');

CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    
    -- Basic metadata
    title VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) UNIQUE,
    
    -- Video file information
    original_filename VARCHAR(255),
    file_size BIGINT,
    duration INTERVAL,
    resolution VARCHAR(20), -- "1920x1080"
    fps INTEGER,
    bitrate INTEGER,
    codec VARCHAR(50),
    
    -- Processed video files
    video_qualities JSONB, -- {"1080p": "url", "720p": "url", ...}
    hls_playlist_url TEXT,
    dash_manifest_url TEXT,
    
    -- Thumbnails
    thumbnail_url TEXT,
    custom_thumbnails JSONB, -- Array of custom thumbnail URLs
    generated_thumbnails JSONB, -- Auto-generated thumbnails at different timestamps
    
    -- Visibility and status
    status video_status DEFAULT 'draft',
    visibility video_visibility DEFAULT 'private',
    scheduled_publish_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Content settings
    content_rating content_rating DEFAULT 'general',
    age_restricted BOOLEAN DEFAULT FALSE,
    comments_enabled BOOLEAN DEFAULT TRUE,
    likes_enabled BOOLEAN DEFAULT TRUE,
    download_enabled BOOLEAN DEFAULT FALSE,
    
    -- SEO and discovery
    tags TEXT[], -- Array of tags
    language_code VARCHAR(5) DEFAULT 'en',
    captions_available BOOLEAN DEFAULT FALSE,
    
    -- Analytics counters (updated by triggers)
    views_count BIGINT DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    
    -- Monetization
    monetization_enabled BOOLEAN DEFAULT FALSE,
    ad_revenue DECIMAL(10,2) DEFAULT 0,
    
    -- Processing status
    upload_progress INTEGER DEFAULT 0, -- 0-100
    processing_progress INTEGER DEFAULT 0, -- 0-100
    processing_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Video quality variants
CREATE TABLE video_qualities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    quality_label VARCHAR(20) NOT NULL, -- "144p", "240p", "360p", "480p", "720p", "1080p", "1440p", "2160p"
    resolution VARCHAR(20) NOT NULL, -- "1920x1080"
    bitrate INTEGER NOT NULL,
    fps INTEGER,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    codec VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video captions/subtitles
CREATE TABLE video_captions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL,
    language_name VARCHAR(50) NOT NULL,
    caption_type VARCHAR(20) DEFAULT 'subtitle', -- 'subtitle', 'closed_caption'
    file_url TEXT NOT NULL,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(video_id, language_code, caption_type)
);

-- Video analytics - detailed view tracking
CREATE TABLE video_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for anonymous
    
    -- View details
    ip_address INET,
    user_agent TEXT,
    country_code VARCHAR(2),
    city VARCHAR(100),
    
    -- Engagement metrics
    watch_duration INTERVAL,
    percentage_watched DECIMAL(5,2),
    quality_watched VARCHAR(20),
    
    -- Device info
    device_type VARCHAR(20), -- 'desktop', 'mobile', 'tablet', 'tv'
    browser VARCHAR(50),
    os VARCHAR(50),
    
    -- Referrer info
    referrer_url TEXT,
    referrer_type VARCHAR(50), -- 'search', 'social', 'direct', 'suggested'
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Comments system with threading
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For replies
    
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    
    -- Engagement
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    
    -- Moderation
    is_deleted BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    moderated_by UUID REFERENCES users(id),
    moderation_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Video likes/dislikes
CREATE TABLE video_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(video_id, user_id)
);

-- Comment likes/dislikes
CREATE TABLE comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(comment_id, user_id)
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification preferences
    notifications_enabled BOOLEAN DEFAULT TRUE,
    notification_frequency VARCHAR(20) DEFAULT 'all', -- 'all', 'occasional', 'none'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(subscriber_id, channel_id),
    CHECK (subscriber_id != channel_id)
);

-- Playlists
CREATE TYPE playlist_visibility AS ENUM ('public', 'unlisted', 'private');

CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    
    visibility playlist_visibility DEFAULT 'public',
    is_collaborative BOOLEAN DEFAULT FALSE,
    
    videos_count INTEGER DEFAULT 0,
    total_duration INTERVAL DEFAULT '0 seconds',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playlist items
CREATE TABLE playlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    added_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    position INTEGER NOT NULL,
    note TEXT, -- Optional note for the video in playlist
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(playlist_id, video_id),
    UNIQUE(playlist_id, position)
);

-- Watch history
CREATE TABLE watch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    
    last_position INTERVAL DEFAULT '0 seconds', -- Where user stopped watching
    watch_count INTEGER DEFAULT 1,
    completed BOOLEAN DEFAULT FALSE, -- Watched to the end
    
    first_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, video_id)
);

-- Live streaming
CREATE TYPE stream_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');

CREATE TABLE live_streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    
    -- Stream settings
    status stream_status DEFAULT 'scheduled',
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    
    -- Technical details
    stream_key VARCHAR(255) UNIQUE NOT NULL,
    rtmp_url TEXT,
    hls_url TEXT,
    
    -- Stream quality
    max_quality VARCHAR(20) DEFAULT '1080p',
    current_quality VARCHAR(20),
    bitrate INTEGER,
    fps INTEGER,
    
    -- Engagement
    peak_viewers INTEGER DEFAULT 0,
    current_viewers INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    
    -- Monetization
    super_chat_enabled BOOLEAN DEFAULT TRUE,
    donations_enabled BOOLEAN DEFAULT TRUE,
    
    -- Recording
    auto_record BOOLEAN DEFAULT TRUE,
    recorded_video_id UUID REFERENCES videos(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Live chat messages
CREATE TABLE live_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    message TEXT NOT NULL,
    is_super_chat BOOLEAN DEFAULT FALSE,
    super_chat_amount DECIMAL(10,2),
    super_chat_currency VARCHAR(3),
    
    is_deleted BOOLEAN DEFAULT FALSE,
    is_moderator_message BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monetization - Channel memberships
CREATE TABLE channel_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    tier_name VARCHAR(100) NOT NULL,
    tier_description TEXT,
    monthly_price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    perks JSONB, -- Array of membership perks
    badge_url TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User channel memberships
CREATE TABLE user_channel_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES channel_memberships(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'cancelled', 'expired'
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, channel_id)
);

-- Content moderation
CREATE TYPE report_type AS ENUM ('spam', 'harassment', 'hate_speech', 'violence', 'sexual_content', 'copyright', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

CREATE TABLE content_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- What's being reported
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Reporting a user/channel
    
    report_type report_type NOT NULL,
    description TEXT,
    status report_status DEFAULT 'pending',
    
    -- Moderation
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CHECK (
        (video_id IS NOT NULL)::integer + 
        (comment_id IS NOT NULL)::integer + 
        (user_id IS NOT NULL)::integer = 1
    )
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_videos_creator_id ON videos(creator_id);
CREATE INDEX idx_videos_category_id ON videos(category_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_visibility ON videos(visibility);
CREATE INDEX idx_videos_published_at ON videos(published_at);
CREATE INDEX idx_videos_views_count ON videos(views_count);
CREATE INDEX idx_videos_tags ON videos USING GIN(tags);
CREATE INDEX idx_videos_title_search ON videos USING GIN(to_tsvector('english', title));
CREATE INDEX idx_videos_description_search ON videos USING GIN(to_tsvector('english', description));

CREATE INDEX idx_video_views_video_id ON video_views(video_id);
CREATE INDEX idx_video_views_viewer_id ON video_views(viewer_id);
CREATE INDEX idx_video_views_started_at ON video_views(started_at);
CREATE INDEX idx_video_views_country ON video_views(country_code);

CREATE INDEX idx_comments_video_id ON comments(video_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

CREATE INDEX idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);
CREATE INDEX idx_subscriptions_channel_id ON subscriptions(channel_id);
CREATE INDEX idx_subscriptions_created_at ON subscriptions(created_at);

CREATE INDEX idx_playlists_creator_id ON playlists(creator_id);
CREATE INDEX idx_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX idx_playlist_items_video_id ON playlist_items(video_id);

CREATE INDEX idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX idx_watch_history_video_id ON watch_history(video_id);
CREATE INDEX idx_watch_history_last_watched_at ON watch_history(last_watched_at);

-- Triggers for updating counters and timestamps
CREATE OR REPLACE FUNCTION update_video_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update video stats when new record is added
        IF TG_TABLE_NAME = 'video_reactions' THEN
            IF NEW.reaction_type = 'like' THEN
                UPDATE videos SET likes_count = likes_count + 1 WHERE id = NEW.video_id;
            ELSIF NEW.reaction_type = 'dislike' THEN
                UPDATE videos SET dislikes_count = dislikes_count + 1 WHERE id = NEW.video_id;
            END IF;
        ELSIF TG_TABLE_NAME = 'comments' AND NEW.parent_id IS NULL THEN
            UPDATE videos SET comments_count = comments_count + 1 WHERE id = NEW.video_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Update video stats when record is deleted
        IF TG_TABLE_NAME = 'video_reactions' THEN
            IF OLD.reaction_type = 'like' THEN
                UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.video_id;
            ELSIF OLD.reaction_type = 'dislike' THEN
                UPDATE videos SET dislikes_count = GREATEST(dislikes_count - 1, 0) WHERE id = OLD.video_id;
            END IF;
        ELSIF TG_TABLE_NAME = 'comments' AND OLD.parent_id IS NULL THEN
            UPDATE videos SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.video_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_video_reactions_counter
    AFTER INSERT OR DELETE ON video_reactions
    FOR EACH ROW EXECUTE FUNCTION update_video_counters();

CREATE TRIGGER trigger_comments_counter
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_video_counters();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_live_streams_updated_at
    BEFORE UPDATE ON live_streams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data
INSERT INTO categories (name, slug, description, icon_url, color_hex) VALUES
('Gaming', 'gaming', 'Video games and gaming content', '/icons/gaming.svg', '#FF6B6B'),
('Music', 'music', 'Music videos and audio content', '/icons/music.svg', '#4ECDC4'),
('Education', 'education', 'Educational and tutorial content', '/icons/education.svg', '#45B7D1'),
('Entertainment', 'entertainment', 'Comedy, shows, and entertainment', '/icons/entertainment.svg', '#96CEB4'),
('Technology', 'technology', 'Tech reviews and tutorials', '/icons/tech.svg', '#FFEAA7'),
('Sports', 'sports', 'Sports highlights and analysis', '/icons/sports.svg', '#DDA0DD'),
('News', 'news', 'News and current events', '/icons/news.svg', '#98D8C8'),
('Lifestyle', 'lifestyle', 'Vlogs and lifestyle content', '/icons/lifestyle.svg', '#F7DC6F'),
('Science', 'science', 'Science and research content', '/icons/science.svg', '#BB8FCE'),
('Travel', 'travel', 'Travel vlogs and guides', '/icons/travel.svg', '#85C1E9');

-- Create admin user (password: admin123)
INSERT INTO users (email, username, password_hash, role, display_name, email_verified, creator_verified, verification_badge) VALUES
('admin@videostream.pro', 'admin', '$2b$10$8K7QYrF.QXB1m3nGvF5gIeX.FqCj7LhRw9XxGg2cJ8aEj3kGhIpW6', 'super_admin', 'Platform Admin', true, 'verified', true);

COMMENT ON DATABASE postgres IS 'VideoStream Pro - YouTube Alternative Database';