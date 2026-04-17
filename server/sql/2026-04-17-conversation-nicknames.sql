-- Adds per-user nicknames for one-to-one conversations.
CREATE TABLE IF NOT EXISTS conversation_nicknames (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_conversation_nickname UNIQUE (conversation_id, owner_user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_nicknames_conversation ON conversation_nicknames(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_nicknames_owner ON conversation_nicknames(owner_user_id);
