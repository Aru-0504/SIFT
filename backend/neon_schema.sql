-- Create SIFT database tables in Neon PostgreSQL

-- Users table for our own auth system
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Watchlist items: symbols each user is tracking
CREATE TABLE IF NOT EXISTS watchlist_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist_items(user_id);

-- User checkpoints: last price/timestamp each user saw per symbol
CREATE TABLE IF NOT EXISTS user_checkpoints (
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    last_seen_price NUMERIC NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY(user_id, symbol)
);

-- Detected changes: significant price movements detected for users
CREATE TABLE IF NOT EXISTS detected_changes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    previous_price NUMERIC NOT NULL,
    current_price NUMERIC NOT NULL,
    pct_change NUMERIC NOT NULL,
    significance_score NUMERIC NOT NULL,
    signals JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'unseen', -- unseen | acknowledged
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying unseen changes efficiently
CREATE INDEX IF NOT EXISTS idx_changes_user_status ON detected_changes(user_id, status);

-- User flags: stocks the user wants to keep visible for later
CREATE TABLE IF NOT EXISTS watchlist_flags (
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY(user_id, symbol)
);
