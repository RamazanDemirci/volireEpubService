-- 1. Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255),
    last_used_profile_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(50) PRIMARY KEY,
    account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    avatar_id INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}', 
    reader_params JSONB DEFAULT '{}',
    last_book_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Book Metadata
CREATE TABLE IF NOT EXISTS book_metadata (
    id VARCHAR(50) PRIMARY KEY,
    fingerprint VARCHAR(64) UNIQUE NOT NULL,
    original_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Book Progress
CREATE TABLE IF NOT EXISTS book_progress (
    profile_id VARCHAR(50) REFERENCES profiles(id) ON DELETE CASCADE,
    book_id VARCHAR(50) REFERENCES book_metadata(id) ON DELETE CASCADE,
    last_part_index INTEGER DEFAULT 0,
    last_word_index INTEGER DEFAULT 0,
    total_word_count INTEGER DEFAULT 0,
    updated_at BIGINT NOT NULL, 
    PRIMARY KEY (profile_id, book_id)
);