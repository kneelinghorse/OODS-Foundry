-- Sprint 29 · Mission B29.2 — communication.channels configuration registry
-- Stores per-tenant channel definitions with typed config payloads + enablement state.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'push', 'in_app', 'webhook')),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channels_name_unique UNIQUE (organization_id, name)
);

COMMENT ON TABLE communication.channels IS 'Channel configuration catalog (SMTP, SMS, Push, Webhook, In-app).';
COMMENT ON COLUMN communication.channels.channel_type IS 'Channel medium used for delivery (R20.6 Part 2.1).';

CREATE INDEX IF NOT EXISTS idx_channels_org_type ON communication.channels (organization_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_channels_config ON communication.channels USING GIN (config);

COMMIT;
