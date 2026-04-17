-- Adds per-user clear timestamps for one-to-one conversations.
-- Clearing a conversation should only affect the requesting user.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_1_cleared_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS user_2_cleared_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_conversations_user_1_cleared_at ON conversations(user_1_cleared_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_2_cleared_at ON conversations(user_2_cleared_at);
