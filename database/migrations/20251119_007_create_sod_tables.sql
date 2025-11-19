-- Sprint 28 · Mission B28.2 — Segregation of Duties tables (R28.1 patterns)
-- Includes static conflict registry + action log for dynamic auditing.

BEGIN;

CREATE TABLE IF NOT EXISTS authz.sod_role_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_a_id uuid NOT NULL REFERENCES authz.roles(id) ON DELETE CASCADE,
  role_b_id uuid NOT NULL REFERENCES authz.roles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES core.organizations(id) ON DELETE CASCADE,
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sod_role_conflicts_unique UNIQUE (role_a_id, role_b_id, organization_id),
  CONSTRAINT sod_role_conflicts_distinct CHECK (role_a_id <> role_b_id)
);

COMMENT ON TABLE authz.sod_role_conflicts IS 'Static SoD rule store (R28.1). org_id NULL indicates global conflict.';

CREATE TABLE IF NOT EXISTS authz.action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_log_lookup
  ON authz.action_log(user_id, resource_type, resource_id);

COMMENT ON TABLE authz.action_log IS 'Dynamic SoD audit log (R28.1) for action/resource level checks.';

COMMIT;
