-- Reply persistence migration
-- Run this in your Supabase SQL editor (or Postgres migration runner).

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_parent_message ON public.messages(parent_message_id);

CREATE TABLE IF NOT EXISTS public.message_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  parent_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  parent_sender_name VARCHAR(80),
  parent_snippet VARCHAR(280),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_message_reply UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_replies_message ON public.message_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_parent ON public.message_replies(parent_message_id);
