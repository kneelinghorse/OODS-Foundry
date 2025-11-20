-- Sprint 29 · Mission B29.2 — communication.messages core entity table
-- Stores canonical messages w/ metadata, template references, and threading support.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'push', 'in_app', 'webhook')),
  template_id uuid REFERENCES communication.templates(id) ON DELETE SET NULL,
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  parent_message_id uuid REFERENCES communication.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz,
  CONSTRAINT messages_variables_are_array CHECK (jsonb_typeof(variables) = 'array')
);

COMMENT ON TABLE communication.messages IS 'Atomic messages plus metadata + template linkage (R20.6 TABLE 1).';
COMMENT ON COLUMN communication.messages.parent_message_id IS 'Self-referential FK for conversation threading.';

CREATE INDEX IF NOT EXISTS idx_messages_sender ON communication.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON communication.messages (parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON communication.messages USING GIN (metadata);

COMMIT;
