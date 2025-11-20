-- Sprint 29 · Mission B29.2 — communication.delivery_policies (retry, throttling, quiet hours)
-- Captures per-tenant delivery tuning derived from R20.1 Part 3.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.delivery_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  retry_config jsonb NOT NULL DEFAULT '{"maxAttempts":3,"strategy":"exponential"}'::jsonb,
  throttling_config jsonb NOT NULL DEFAULT '{"windowSeconds":60,"maxMessages":200}'::jsonb,
  quiet_hours jsonb NOT NULL DEFAULT '{"start":"22:00","end":"06:00","timezone":"UTC"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_policies_name_unique UNIQUE (organization_id, name)
);

COMMENT ON TABLE communication.delivery_policies IS 'Retry, throttling, and quiet hour configurations per organization.';

CREATE INDEX IF NOT EXISTS idx_policies_org ON communication.delivery_policies (organization_id);

COMMIT;
