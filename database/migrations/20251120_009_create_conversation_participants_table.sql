-- Sprint 29 · Mission B29.2 — communication.conversation_participants membership table
-- Connects users to conversations w/ roles + read receipts.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES communication.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member', 'viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  CONSTRAINT conversation_participants_unique UNIQUE (conversation_id, user_id)
);

COMMENT ON TABLE communication.conversation_participants IS 'Participant roster for threaded conversations.';

CREATE INDEX IF NOT EXISTS idx_participants_conversation ON communication.conversation_participants (conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON communication.conversation_participants (user_id, last_read_at);

COMMIT;
