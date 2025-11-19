-- Sprint 28 · Mission B28.2 — authz.role_permissions DDL (R21.2 TABLE 3)
-- Junction table storing explicit grants between roles and permissions.

BEGIN;

CREATE TABLE IF NOT EXISTS authz.role_permissions (
  role_id uuid NOT NULL REFERENCES authz.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES authz.permissions(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text,
  CONSTRAINT role_permissions_pk PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON authz.role_permissions(role_id);

COMMENT ON TABLE authz.role_permissions IS 'R21.2 TABLE 3: explicit mapping between authz.roles and authz.permissions.';

COMMIT;
