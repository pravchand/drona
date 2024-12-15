
-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    session_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
-- Message Replies Table
CREATE TABLE IF NOT EXISTS message_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_message_id INTEGER NOT NULL,
    reply_message_id INTEGER NOT NULL,
    FOREIGN KEY (original_message_id) REFERENCES messages(id),
    FOREIGN KEY (reply_message_id) REFERENCES messages(id),
    UNIQUE (original_message_id, reply_message_id)
);

-- Channels Table
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);


-- Message Reactions Table to track user reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
-- User's last seen message connected to a channel
CREATE TABLE IF NOT EXISTS user_channel_last_seen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    last_seen_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, channel_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
);
