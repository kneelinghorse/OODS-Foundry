-- Sprint 29 · Mission B29.2 — communication.message_recipients junction table
-- Tracks per-recipient delivery timestamps + read receipts for each message.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES communication.messages(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_recipient_unique UNIQUE (message_id, recipient_id)
);

COMMENT ON TABLE communication.message_recipients IS 'Recipient delivery tracking (read + delivery timestamps).';

CREATE INDEX IF NOT EXISTS idx_recipients_message ON communication.message_recipients (message_id);
CREATE INDEX IF NOT EXISTS idx_recipients_user ON communication.message_recipients (recipient_id, read_at);

COMMIT;
