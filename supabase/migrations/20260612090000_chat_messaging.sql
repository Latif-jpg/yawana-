CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_preview TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, seller_id, client_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can read conversations" ON chat_conversations;
CREATE POLICY "Participants can read conversations"
ON chat_conversations FOR SELECT
TO authenticated
USING (auth.uid() = seller_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients can create conversations" ON chat_conversations;
CREATE POLICY "Clients can create conversations"
ON chat_conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Participants can read messages" ON chat_messages;
CREATE POLICY "Participants can read messages"
ON chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (c.seller_id = auth.uid() OR c.client_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Participants can send messages" ON chat_messages;
CREATE POLICY "Participants can send messages"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND (c.seller_id = auth.uid() OR c.client_id = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.touch_chat_conversation_after_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chat_conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.body, 160)
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_touch_chat_conversation_after_message ON chat_messages;
CREATE TRIGGER trigger_touch_chat_conversation_after_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_chat_conversation_after_message();

CREATE INDEX IF NOT EXISTS chat_conversations_participants_last_message_idx
  ON chat_conversations (seller_id, client_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_idx
  ON chat_messages (conversation_id, created_at ASC);

NOTIFY pgrst, 'reload schema';
