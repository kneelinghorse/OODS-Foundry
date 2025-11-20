-- Sprint 29 · Mission B29.2 — communication.conversations thread metadata
-- Maintains subject, status, and metadata for threaded conversations.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  subject text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE communication.conversations IS 'Conversation metadata including state + subject for message threads.';

CREATE INDEX IF NOT EXISTS idx_conversations_org_status ON communication.conversations (organization_id, status, updated_at DESC);

COMMIT;
