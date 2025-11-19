-- Sprint 28 · Mission B28.2 — authz.memberships DDL (R21.2 TABLE 4)
-- Critical multi-tenant join bridging Users, Organizations, and Roles.

BEGIN;

CREATE TABLE IF NOT EXISTS authz.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES authz.roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_unique_assignment UNIQUE (user_id, organization_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_org ON authz.memberships(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_role ON authz.memberships(organization_id, role_id);

COMMENT ON TABLE authz.memberships IS 'R21.2 TABLE 4: Multi-tenant RBAC membership linking user + org + role.';
COMMENT ON COLUMN authz.memberships.organization_id IS 'Ensures tenant isolation; ON DELETE CASCADE removes memberships when org is removed.';

COMMIT;
