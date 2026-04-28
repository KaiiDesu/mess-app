    -- ========================================
    -- Zap Messenger - PostgreSQL Schema
    -- Compatible with Supabase
    -- ========================================

    -- Enable necessary extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- ========================================
    -- USERS TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE NOT NULL, -- Supabase auth.users.id
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    status_message TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason VARCHAR(255)
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
    CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm ON users USING GIN(display_name gin_trgm_ops);

    -- ========================================
    -- FRIENDSHIPS TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined, blocked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT different_users CHECK (sender_id != receiver_id)
    );

    -- Unique friendship index (bidirectional)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_unique ON friendships(
        LEAST(sender_id, receiver_id),
        GREATEST(sender_id, receiver_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_friendships_sender ON friendships(sender_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

    -- ========================================
    -- CONVERSATIONS TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Theme/customization
    theme_name VARCHAR(50) DEFAULT 'purple', -- purple, pink, green, orange, blue, etc.
    theme_gradient TEXT, -- stored as "linear-gradient(135deg,#7c6bff,#a78bfa)"
    emoji_set VARCHAR(50) DEFAULT 'default',
    
    -- Metadata
    is_archived BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    muted_until TIMESTAMP,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT different_users CHECK (user_1_id != user_2_id)
    );

    -- Unique conversation index (bidirectional)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique ON conversations(
        LEAST(user_1_id, user_2_id),
        GREATEST(user_1_id, user_2_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_conversations_user_1 ON conversations(user_1_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_2 ON conversations(user_2_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived);

    -- ========================================
    -- MESSAGES TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Content
    content TEXT,
    content_type VARCHAR(50) DEFAULT 'text', -- text, image, video, audio, file
    ciphertext TEXT, -- encrypted message (for E2EE phase)
    
    -- Media references
    media_id UUID, -- references media table

    -- Reply/thread references
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Metadata
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Existing databases may already have the messages table without this column.
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_content_type ON messages(content_type);
    CREATE INDEX IF NOT EXISTS idx_messages_parent_message ON messages(parent_message_id);

    -- Fallback reply relation table for deployments missing messages.parent_message_id.
    -- This keeps reply quotes durable across reloads even before parent column migration is applied.
    CREATE TABLE IF NOT EXISTS message_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    parent_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    parent_sender_name VARCHAR(80),
    parent_snippet VARCHAR(280),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_message_reply UNIQUE (message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_message_replies_message ON message_replies(message_id);
    CREATE INDEX IF NOT EXISTS idx_message_replies_parent ON message_replies(parent_message_id);

    -- ========================================
    -- MESSAGE_READ_RECEIPTS TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS message_read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    reader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_read_receipt UNIQUE (message_id, reader_id)
    );

    CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON message_read_receipts(message_id);
    CREATE INDEX IF NOT EXISTS idx_read_receipts_reader ON message_read_receipts(reader_id);

    -- ========================================
    -- MESSAGE_REACTIONS TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL, -- ❤️, 😂, 😮, 😢, 👍, 🔥, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_reaction UNIQUE (message_id, user_id, emoji)
    );

    CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
    CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id);

    -- ========================================
    -- MEDIA TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- File info
    filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- image, video, audio, document
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    
    -- Storage paths
    storage_path TEXT NOT NULL, -- "messages/user-id/filename.extension"
    storage_url TEXT NOT NULL, -- full CDN URL
    thumbnail_url TEXT, -- for images/videos
    
    -- Metadata
    width_px INTEGER, -- for images/videos
    height_px INTEGER,
    duration_seconds FLOAT, -- for audio/video
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_media_uploader ON media(uploader_id);
    CREATE INDEX IF NOT EXISTS idx_media_file_type ON media(file_type);

    -- ========================================
    -- TYPING_INDICATORS TABLE (transient, TTL recommended)
    -- ========================================
    CREATE TABLE IF NOT EXISTS typing_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_typing UNIQUE (conversation_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_typing_conversation ON typing_indicators(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_typing_user ON typing_indicators(user_id);

    -- ========================================
    -- PUSH_NOTIFICATION_TOKENS TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS push_notification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    device_id VARCHAR(500) UNIQUE NOT NULL,
    device_type VARCHAR(20) NOT NULL, -- ios, android, web
    fcm_token TEXT, -- Firebase Cloud Messaging token (Android)
    apns_token TEXT, -- Apple Push Notification token (iOS)
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_notification_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_device ON push_notification_tokens(device_id);

    -- ========================================
    -- USER_NOTES TABLE (24-hour ephemeral notes)
    -- ========================================
    CREATE TABLE IF NOT EXISTS user_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    content VARCHAR(60) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_notes_expires_at ON user_notes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_user_notes_updated_at ON user_notes(updated_at DESC);

    -- ========================================
    -- NOTIFICATIONS TABLE
    -- ========================================
    CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification type
    type VARCHAR(50) NOT NULL, -- message, friend_request, friend_accepted, mention, typing
    title VARCHAR(200),
    body TEXT,
    
    -- Related entities
    related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    related_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    related_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

    -- ========================================
    -- AUDIT_LOG TABLE (optional, for debugging/compliance)
    -- ========================================
    CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- login, logout, message_sent, friend_request_sent, etc.
    resource_type VARCHAR(50), -- user, message, friendship, etc.
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);

    -- ========================================
    -- VIEWS (for convenience)
    -- ========================================

    -- Get all friendships for a user (bidirectional)
    CREATE OR REPLACE VIEW user_friends AS
    SELECT 
    CASE 
        WHEN f.sender_id = u.id THEN f.receiver_id 
        ELSE f.sender_id 
    END as friend_id,
    f.status,
    f.created_at,
    f.updated_at,
    u.id as current_user_id
    FROM friendships f
    CROSS JOIN users u
    WHERE (f.sender_id = u.id OR f.receiver_id = u.id) 
    AND f.status = 'accepted';

    -- Get active conversations with latest message metadata
    CREATE OR REPLACE VIEW active_conversations AS
    SELECT 
    c.id,
    c.user_1_id,
    c.user_2_id,
    CASE WHEN c.user_1_id = auth.uid() THEN c.user_2_id ELSE c.user_1_id END as other_user_id,
    (SELECT display_name FROM users WHERE id = (
        CASE WHEN c.user_1_id = auth.uid() THEN c.user_2_id ELSE c.user_1_id END
    )) as other_user_name,
    (SELECT avatar_url FROM users WHERE id = (
        CASE WHEN c.user_1_id = auth.uid() THEN c.user_2_id ELSE c.user_1_id END
    )) as other_user_avatar,
    c.theme_name,
    c.theme_gradient,
    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as latest_message,
    (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as latest_message_at,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_deleted = FALSE) as message_count,
    c.is_archived,
    c.is_muted,
    c.created_at,
    c.updated_at
    FROM conversations c
    WHERE c.user_1_id = auth.uid() OR c.user_2_id = auth.uid();

    -- ========================================
    -- ROW-LEVEL SECURITY (RLS) POLICIES
    -- ========================================

    -- Note: Enable RLS on each table first:
    -- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    -- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
    -- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    -- etc.

    -- Users can read their own profile
    DROP POLICY IF EXISTS "Users can read own profile" ON users;
    CREATE POLICY "Users can read own profile"
    ON users FOR SELECT
    USING (auth.uid() = auth_id);

    -- Users can read profiles of friends
    DROP POLICY IF EXISTS "Users can read friend profiles" ON users;
    CREATE POLICY "Users can read friend profiles"
    ON users FOR SELECT
    USING (
        id IN (
        SELECT CASE 
            WHEN sender_id = auth.uid() THEN receiver_id 
            ELSE sender_id 
        END
        FROM friendships 
        WHERE status = 'accepted' AND (sender_id = auth.uid() OR receiver_id = auth.uid())
        )
    );

    -- Users can read conversations they're part of
    DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
    CREATE POLICY "Users can read own conversations"
    ON conversations FOR SELECT
    USING (user_1_id = auth.uid() OR user_2_id = auth.uid());

    -- Users can insert conversations
    DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
    CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (user_1_id = auth.uid() OR user_2_id = auth.uid());

    -- Users can read messages from conversations they're part of
    DROP POLICY IF EXISTS "Users can read conversation messages" ON messages;
    CREATE POLICY "Users can read conversation messages"
    ON messages FOR SELECT
    USING (
        conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_1_id = auth.uid() OR user_2_id = auth.uid()
        )
    );

    -- Users can insert messages to conversations they're part of
    DROP POLICY IF EXISTS "Users can send messages" ON messages;
    CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND
        conversation_id IN (
        SELECT id FROM conversations 
        WHERE user_1_id = auth.uid() OR user_2_id = auth.uid()
        )
    );

    -- Users can read friendships involving them
    DROP POLICY IF EXISTS "Users can read own friendships" ON friendships;
    CREATE POLICY "Users can read own friendships"
    ON friendships FOR SELECT
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

    -- Users can create friend requests
    DROP POLICY IF EXISTS "Users can send friend requests" ON friendships;
    CREATE POLICY "Users can send friend requests"
    ON friendships FOR INSERT
    WITH CHECK (sender_id = auth.uid());

    -- ========================================
    -- TRIGGER FUNCTIONS
    -- ========================================

    -- Update users.updated_at on row change
    CREATE OR REPLACE FUNCTION update_users_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
    CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

    -- Update conversations.updated_at when new message posted
    CREATE OR REPLACE FUNCTION update_conversation_on_message()
    RETURNS TRIGGER AS $$
    BEGIN
    UPDATE conversations 
    SET updated_at = CURRENT_TIMESTAMP, last_message_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_conversation_update_on_message ON messages;
    CREATE TRIGGER trigger_conversation_update_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

    -- ========================================
    -- SAMPLE QUERIES FOR COMMON OPERATIONS
    -- ========================================

    /*
    -- Get user's conversations sorted by recency
    SELECT * FROM active_conversations ORDER BY latest_message_at DESC;

    -- Get messages in a conversation with read status
    SELECT 
    m.*,
    (SELECT COUNT(*) FROM message_read_receipts WHERE message_id = m.id) as read_count
    FROM messages m
    WHERE conversation_id = '...'
    ORDER BY created_at DESC;

    -- Get friend requests for current user
    SELECT u.*, f.created_at as requested_at
    FROM friendships f
    JOIN users u ON f.sender_id = u.id
    WHERE f.receiver_id = auth.uid() AND f.status = 'pending';

    -- Search for users by username or display name
    SELECT * FROM users 
    WHERE username ILIKE '%query%' OR display_name ILIKE '%query%'
    LIMIT 20;

    -- Get unread message count per conversation
    SELECT 
    c.id,
    COUNT(m.id) as unread_count
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    LEFT JOIN message_read_receipts r ON m.id = r.message_id AND r.reader_id = auth.uid()
    WHERE (c.user_1_id = auth.uid() OR c.user_2_id = auth.uid())
    AND (c.user_1_id = auth.uid() AND m.sender_id != auth.uid() OR c.user_2_id = auth.uid() AND m.sender_id != auth.uid())
    AND r.id IS NULL
    GROUP BY c.id;
    */
