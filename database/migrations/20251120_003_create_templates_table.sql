-- Sprint 29 · Mission B29.2 — communication.templates message templates
-- Enforces placeholder coverage and locale aware template catalog.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'push', 'in_app', 'webhook')),
  name text NOT NULL,
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  locale text NOT NULL DEFAULT 'en-US',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT templates_name_unique UNIQUE (organization_id, name),
  CONSTRAINT templates_variables_are_array CHECK (jsonb_typeof(variables) = 'array'),
  CONSTRAINT templates_body_covers_variables CHECK (
    NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(variables, '[]'::jsonb)) AS elem(value)
      WHERE position(('{{' || elem.value || '}}') IN body) = 0
    )
  )
);

COMMENT ON TABLE communication.templates IS 'Per-channel message templates w/ placeholder enforcement.';
COMMENT ON COLUMN communication.templates.variables IS 'JSON array of template variables (validated against body).';

CREATE INDEX IF NOT EXISTS idx_templates_org_channel ON communication.templates (organization_id, channel_type);

COMMIT;
